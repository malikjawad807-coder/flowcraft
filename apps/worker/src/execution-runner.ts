import { workflows, executions, executionSteps, eq } from '@flowcart/db';
import { WorkflowExecutor, validateGraph } from '@flowcart/engine';
import { GmailClient } from '@flowcart/gmail';
import { LLMService } from '@flowcart/llm';
import { WorkerGmailTokenService } from './gmail-token.service.js';

export interface ExecutionRunnerDependencies {
  db: any;
  tokenService: WorkerGmailTokenService;
  llmService?: LLMService;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
}

export async function handleWorkflowExecJob(
  jobData: { executionId: string; workflowId: string; userId: string },
  deps: ExecutionRunnerDependencies
): Promise<{ success: boolean; status: string }> {
  const { db, tokenService, logger } = deps;
  const { executionId, workflowId, userId } = jobData;

  const [execRow] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);

  if (!execRow) {
    logger.error(`Execution record ${executionId} not found.`);
    return { success: false, status: 'not_found' };
  }

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) {
    logger.error(`Workflow ${workflowId} not found for execution ${executionId}.`);
    await db
      .update(executions)
      .set({
        status: 'failed',
        error: 'Workflow record not found',
        finishedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
    return { success: false, status: 'failed' };
  }

  // 1. Re-validate graph (Section 8.5 rule 1)
  const validation = validateGraph(workflow.graph, { isActivating: false });
  if (!validation.valid) {
    const errorMsg = validation.errors.map((e) => e.message).join('; ');
    await db
      .update(executions)
      .set({
        status: 'failed',
        error: `Graph validation failed: ${errorMsg}`,
        finishedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
    return { success: false, status: 'failed' };
  }

  // 2. Mark running
  await db
    .update(executions)
    .set({
      status: 'running',
      startedAt: new Date(),
    })
    .where(eq(executions.id, executionId));

  // 3. Resolve Gmail client if connected integration exists
  let gmailClient: GmailClient | undefined = undefined;
  if (workflow.integrationId) {
    try {
      const auth = await tokenService.getAuthenticatedClient(
        workflow.integrationId,
        userId
      );
      gmailClient = new GmailClient(auth);
    } catch (authErr: any) {
      logger.error(`Failed to get Gmail client for workflow ${workflowId}: ${authErr.message}`);
    }
  }

  // 4. Run through WorkflowExecutor
  const executor = new WorkflowExecutor();
  const initialItems = execRow.triggerData ? [{ json: execRow.triggerData }] : [];

  try {
    const execResult = await executor.execute(workflow.graph, {
      executionId,
      workflowId,
      userId,
      mode: execRow.mode as any,
      initialItems,
      dryRun: false,
      gmailClient,
      llmClient: deps.llmService?.getAdapter({ userId }),
      onStepComplete: async (step) => {
        await db.insert(executionSteps).values({
          executionId,
          nodeId: step.nodeId,
          nodeType: step.nodeType,
          itemIndex: step.itemIndex,
          status: step.status,
          input: step.input,
          output: step.output,
          error: step.error,
          attempts: step.attempts,
          startedAt: new Date(step.startedAt),
          finishedAt: step.finishedAt ? new Date(step.finishedAt) : new Date(),
        });
      },
    });

    // 5. Update execution summary in DB
    await db
      .update(executions)
      .set({
        status: execResult.status,
        error: execResult.error || null,
        finishedAt: execResult.finishedAt ? new Date(execResult.finishedAt) : new Date(),
      })
      .where(eq(executions.id, executionId));

    return { success: execResult.status === 'success', status: execResult.status };
  } catch (err: any) {
    logger.error(`Execution ${executionId} fatal error: ${err.message}`);
    await db
      .update(executions)
      .set({
        status: 'failed',
        error: err.message,
        finishedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
    return { success: false, status: 'failed' };
  }
}

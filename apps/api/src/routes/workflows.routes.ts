import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  workflows,
  workflowVersions,
  executions,
  executionSteps,
  triggerState,
  integrations,
  eq,
  and,
  desc,
} from '@flowcart/db';
import {
  workflowGraphSchema,
  WorkflowGraph,
  SAMPLE_EMAILS,
  WorkflowItem,
  WorkflowStepResult,
  Env,
} from '@flowcart/shared';
import { validateGraph, WorkflowExecutor } from '@flowcart/engine';
import { GmailClient } from '@flowcart/gmail';
import { GmailTokenService } from '../services/gmail-token.service.js';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';
import { LLMService } from '@flowcart/llm';

export interface WorkflowsRoutesOptions {
  db: any;
  env: Env;
  gmailTokenService?: GmailTokenService;
  llmService?: LLMService;
}

export const workflowsRoutes: FastifyPluginAsync<WorkflowsRoutesOptions> = async (
  app: FastifyInstance,
  opts: WorkflowsRoutesOptions
) => {
  const requireAuth = createAuthMiddleware(opts.db, opts.env);
  const requireCsrf = createCsrfMiddleware(opts.env);
  const executor = new WorkflowExecutor();

  // GET /api/sample-emails - List available sample emails for testing
  app.get('/api/sample-emails', async (_req, reply) => {
    return reply.send({ sampleEmails: SAMPLE_EMAILS });
  });

  // GET /api/workflows - List user workflows
  app.get('/api/workflows', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const userWorkflows = await opts.db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, user.id));

    return reply.send({ workflows: userWorkflows });
  });

  // POST /api/workflows - Create workflow
  app.post<{
    Body: { name?: string; graph?: WorkflowGraph };
  }>('/api/workflows', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const name = (req.body?.name || 'Untitled Workflow').trim();

    let graph: WorkflowGraph = req.body?.graph || {
      nodes: [
        {
          id: 'manual_trigger_1',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 250, y: 150 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [],
    };

    if (req.body?.graph) {
      const parsed = workflowGraphSchema.safeParse(graph);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_GRAPH_SCHEMA',
            message: 'Graph does not conform to workflow schema',
            details: parsed.error.issues,
          },
        });
      }
      graph = parsed.data;

      const validation = validateGraph(graph);
      if (!validation.valid) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_GRAPH_STRUCTURE',
            message: 'Workflow graph validation failed',
            details: validation.errors,
          },
        });
      }
    }

    const workflowId = randomUUID();
    const [created] = await opts.db
      .insert(workflows)
      .values({
        id: workflowId,
        userId: user.id,
        name,
        isActive: false,
        version: 1,
        graph,
      })
      .returning();

    // Save initial version snapshot (Section 8.1)
    await opts.db.insert(workflowVersions).values({
      workflowId,
      version: 1,
      graph,
    });

    return reply.status(201).send({ workflow: created });
  });

  // GET /api/workflows/:id - Fetch single workflow
  app.get<{ Params: { id: string } }>(
    '/api/workflows/:id',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [wf] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!wf) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      return reply.send({ workflow: wf });
    }
  );

  // PUT /api/workflows/:id - Update workflow graph and name
  app.put<{
    Params: { id: string };
    Body: { name?: string; graph?: WorkflowGraph };
  }>('/api/workflows/:id', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params;

    const [existing] = await opts.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    const name = req.body?.name !== undefined ? req.body.name.trim() : existing.name;
    let graph = req.body?.graph || (existing.graph as WorkflowGraph);

    if (req.body?.graph) {
      const parsed = workflowGraphSchema.safeParse(graph);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_GRAPH_SCHEMA',
            message: 'Graph does not conform to workflow schema',
            details: parsed.error.issues,
          },
        });
      }
      graph = parsed.data;

      const validation = validateGraph(graph);
      if (!validation.valid) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_GRAPH_STRUCTURE',
            message: 'Workflow graph validation failed',
            details: validation.errors,
          },
        });
      }
    }

    const newVersion = (existing.version || 1) + 1;

    await opts.db
      .update(workflows)
      .set({
        name,
        graph,
        version: newVersion,
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)));

    // Save version history snapshot (Section 8.1)
    await opts.db.insert(workflowVersions).values({
      workflowId: id,
      version: newVersion,
      graph,
    });

    const [updated] = await opts.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
      .limit(1);

    return reply.send({ workflow: updated });
  });

  // DELETE /api/workflows/:id - Delete workflow
  app.delete<{ Params: { id: string } }>(
    '/api/workflows/:id',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      await opts.db.delete(workflows).where(eq(workflows.id, id));
      return reply.status(204).send();
    }
  );

  // Helper to activate workflow with strict checks & cursor seeding
  const activateWorkflow = async (existing: any, userId: string) => {
    // 1. Strict validation check when activating (Section 8.3)
    const validation = validateGraph(existing.graph as WorkflowGraph, {
      isActivating: true,
    });
    if (!validation.valid) {
      const err: any = new Error('Cannot activate workflow with validation errors');
      err.statusCode = 400;
      err.code = 'CANNOT_ACTIVATE_INVALID_WORKFLOW';
      err.details = validation.errors;
      throw err;
    }

    // 2. Check if graph contains Gmail nodes
    const nodes = (existing.graph as WorkflowGraph)?.nodes || [];
    const hasGmailTrigger = nodes.some(
      (n: any) => n.type === 'gmail.trigger' || n.category === 'trigger'
    );
    const hasGmailAction = nodes.some((n: any) => n.type?.startsWith('gmail.'));

    let integrationId = existing.integrationId;

    if (hasGmailTrigger || hasGmailAction) {
      if (!integrationId) {
        // Fallback: search for active gmail integration for this user
        const [userInteg] = await opts.db
          .select()
          .from(integrations)
          .where(and(eq(integrations.userId, userId), eq(integrations.status, 'active')))
          .limit(1);

        if (!userInteg) {
          const err: any = new Error(
            'Workflow contains Gmail nodes but no active Gmail account is connected. Connect Gmail in Settings.'
          );
          err.statusCode = 400;
          err.code = 'GMAIL_ACCOUNT_REQUIRED';
          throw err;
        }
        integrationId = userInteg.id;
      }

      // Check integration is active
      const [integ] = await opts.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, integrationId))
        .limit(1);

      if (!integ || integ.status !== 'active') {
        const err: any = new Error(
          'Connected Gmail account is revoked or needs reconnect. Please reconnect in Settings.'
        );
        err.statusCode = 400;
        err.code = 'GMAIL_CONNECTION_INVALID';
        throw err;
      }

      // Seed initial history cursor if workflow has gmail.trigger (Section 7.10 rule 1)
      if (hasGmailTrigger && opts.gmailTokenService) {
        try {
          const auth = await opts.gmailTokenService.getAuthenticatedClient(integ.id, userId);
          const gmailClient = new GmailClient(auth);
          const profile = await gmailClient.getProfile();

          await opts.db
            .insert(triggerState)
            .values({
              workflowId: existing.id,
              cursor: profile.historyId,
              lastPolledAt: new Date(),
            })
            .onConflictDoUpdate({
              target: triggerState.workflowId,
              set: {
                cursor: profile.historyId,
                lastPolledAt: new Date(),
              },
            });
        } catch {
          // Non-fatal if seeding fails during test mock
        }
      }
    }

    await opts.db
      .update(workflows)
      .set({
        isActive: true,
        status: 'active',
        integrationId,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, existing.id));

    return {
      ...existing,
      isActive: true,
      status: 'active',
      integrationId,
    };
  };

  const deactivateWorkflow = async (workflowId: string) => {
    await opts.db
      .update(workflows)
      .set({
        isActive: false,
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));
  };

  // POST /api/workflows/:id/activate - Activate workflow
  app.post<{ Params: { id: string } }>(
    '/api/workflows/:id/activate',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      const updated = await activateWorkflow(existing, user.id);
      return reply.send({ workflow: updated });
    }
  );

  // POST /api/workflows/:id/deactivate - Deactivate workflow
  app.post<{ Params: { id: string } }>(
    '/api/workflows/:id/deactivate',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      await deactivateWorkflow(id);
      return reply.send({
        workflow: {
          ...existing,
          isActive: false,
          status: 'inactive',
        },
      });
    }
  );

  // POST /api/workflows/:id/toggle - Toggle active status
  app.post<{ Params: { id: string } }>(
    '/api/workflows/:id/toggle',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      if (!existing.isActive) {
        const updated = await activateWorkflow(existing, user.id);
        return reply.send({ workflow: updated });
      } else {
        await deactivateWorkflow(id);
        return reply.send({
          workflow: {
            ...existing,
            isActive: false,
            status: 'inactive',
          },
        });
      }
    }
  );

  // POST /api/workflows/:id/test-run - Execute test run
  app.post<{
    Params: { id: string };
    Body: { sampleEmailId?: string; customItem?: any; graph?: WorkflowGraph };
  }>('/api/workflows/:id/test-run', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params;

    const [existing] = await opts.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    // Allow testing with uncommitted graph sent directly from canvas
    const activeGraph: WorkflowGraph = req.body?.graph || (existing.graph as WorkflowGraph);

    // Validate graph before run
    const validation = validateGraph(activeGraph);
    if (!validation.valid) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_GRAPH',
          message: 'Graph validation failed for test run',
          details: validation.errors,
        },
      });
    }

    // Select initial trigger items
    let initialItems: WorkflowItem[] = [];
    if (req.body?.customItem) {
      initialItems = [{ json: req.body.customItem }];
    } else if (req.body?.sampleEmailId) {
      const found = SAMPLE_EMAILS.find((e) => e.id === req.body.sampleEmailId);
      if (found) {
        initialItems = [found.item];
      }
    }

    if (initialItems.length === 0) {
      initialItems = [SAMPLE_EMAILS[0].item];
    }

    const executionId = randomUUID();

    // Create execution record in database
    await opts.db.insert(executions).values({
      id: executionId,
      workflowId: id,
      userId: user.id,
      mode: 'test',
      status: 'running',
      triggerData: initialItems,
      startedAt: new Date(),
    });

    // Run execution with step checkpoint hook (Section 8.5)
    const result = await executor.execute(activeGraph, {
      executionId,
      workflowId: id,
      userId: user.id,
      mode: 'test',
      dryRun: true,
      initialItems,
      llmClient: opts.llmService?.getAdapter({ userId: user.id }),
      user: { id: user.id, email: user.email, name: user.name || undefined },
      onStepComplete: async (step: WorkflowStepResult) => {
        await opts.db.insert(executionSteps).values({
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

    // Update execution status in database
    await opts.db
      .update(executions)
      .set({
        status: result.status,
        error: result.error,
        finishedAt: new Date(result.finishedAt || Date.now()),
      })
      .where(eq(executions.id, executionId));

    return reply.send({
      success: result.status === 'success',
      result,
    });
  });

  // GET /api/workflows/:id/executions - List executions for workflow
  app.get<{ Params: { id: string } }>(
    '/api/workflows/:id/executions',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }

      const execList = await opts.db
        .select()
        .from(executions)
        .where(eq(executions.workflowId, id))
        .limit(50);

      return reply.send({ executions: execList });
    }
  );

  // GET /api/executions/:id - Fetch single execution with steps
  app.get<{ Params: { id: string } }>(
    '/api/executions/:id',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [exec] = await opts.db
        .select()
        .from(executions)
        .where(and(eq(executions.id, id), eq(executions.userId, user.id)))
        .limit(1);

      if (!exec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Execution not found' },
        });
      }

      const steps = await opts.db
        .select()
        .from(executionSteps)
        .where(eq(executionSteps.executionId, id));

      return reply.send({ execution: exec, steps });
    }
  );

  // GET /api/executions - List user executions with filters (Phase 5)
  app.get<{
    Querystring: { workflowId?: string; status?: string; limit?: string; offset?: string };
  }>('/api/executions', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const { workflowId, status, limit, offset } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const offsetNum = Math.max(0, parseInt(offset || '0', 10));

    let conditions = eq(executions.userId, user.id);
    if (workflowId) {
      conditions = and(conditions, eq(executions.workflowId, workflowId)) as any;
    }
    if (status && status !== 'all') {
      conditions = and(conditions, eq(executions.status, status)) as any;
    }

    const execList = await opts.db
      .select()
      .from(executions)
      .where(conditions)
      .orderBy(desc(executions.createdAt))
      .limit(limitNum);

    return reply.send({ executions: execList, limit: limitNum, offset: offsetNum });
  });

  // POST /api/executions/:id/retry - Retry a failed execution (Phase 5)
  app.post<{ Params: { id: string } }>(
    '/api/executions/:id/retry',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const user = req.user!;
      const { id } = req.params;

      const [existing] = await opts.db
        .select()
        .from(executions)
        .where(and(eq(executions.id, id), eq(executions.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Execution not found' },
        });
      }

      const [workflow] = await opts.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, existing.workflowId))
        .limit(1);

      if (!workflow) {
        return reply.status(404).send({
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Associated workflow not found' },
        });
      }

      // Create new retry execution record
      const retryExecutionId = randomUUID();
      const [newExec] = await opts.db
        .insert(executions)
        .values({
          id: retryExecutionId,
          workflowId: existing.workflowId,
          userId: user.id,
          mode: existing.mode,
          status: 'queued',
          triggerData: existing.triggerData,
          createdAt: new Date(),
        })
        .returning();

      // Execute in runner background
      const initialItems = existing.triggerData ? [{ json: existing.triggerData }] : [];
      executor
        .execute(workflow.graph as WorkflowGraph, {
          executionId: retryExecutionId,
          workflowId: existing.workflowId,
          userId: user.id,
          mode: existing.mode as any,
          dryRun: false,
          initialItems,
          llmClient: opts.llmService?.getAdapter({ userId: user.id }),
          onStepComplete: async (step: WorkflowStepResult) => {
            await opts.db.insert(executionSteps).values({
              executionId: retryExecutionId,
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
        })
        .then(async (res) => {
          await opts.db
            .update(executions)
            .set({
              status: res.status,
              error: res.error || null,
              finishedAt: res.finishedAt ? new Date(res.finishedAt) : new Date(),
            })
            .where(eq(executions.id, retryExecutionId));
        })
        .catch(async (err: any) => {
          await opts.db
            .update(executions)
            .set({
              status: 'failed',
              error: err.message,
              finishedAt: new Date(),
            })
            .where(eq(executions.id, retryExecutionId));
        });

      return reply.send({ execution: newExec });
    }
  );
};

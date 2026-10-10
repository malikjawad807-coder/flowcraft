import { workflows, eq } from '@flowcart/db';
import { Queue } from 'bullmq';
import { QUEUE_GMAIL_POLL } from './queues.js';

export interface ReconciliationDependencies {
  db: any;
  pollQueue: Queue;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
}

/**
 * Reconciles BullMQ repeatable jobs with active database workflows (Section 7.10 & 14).
 */
export async function reconcilePollingJobs(
  deps: ReconciliationDependencies
): Promise<{ added: number; removed: number; activeCount: number }> {
  const { db, pollQueue, logger } = deps;

  // 1. Fetch all active workflows from database
  const activeWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.status, 'active'));

  const activeWithGmailTrigger = activeWorkflows.filter((wf: any) => {
    const nodes = wf.graph?.nodes || [];
    return nodes.some((n: any) => n.type === 'gmail.trigger' || n.category === 'trigger');
  });

  const activeMap = new Map<string, any>(
    activeWithGmailTrigger.map((wf: any) => [wf.id, wf])
  );

  // 2. Fetch existing repeatable jobs from BullMQ
  const existingRepeatableJobs = await pollQueue.getRepeatableJobs();
  let removedCount = 0;
  let addedCount = 0;

  // Remove repeatable jobs for workflows that are no longer active
  for (const job of existingRepeatableJobs) {
    const wfId = job.name.startsWith('poll:') ? job.name.replace('poll:', '') : null;
    if (wfId && !activeMap.has(wfId)) {
      await pollQueue.removeRepeatableByKey(job.key);
      logger.info(`Removed repeatable polling job for inactive workflow: ${wfId}`);
      removedCount++;
    }
  }

  // Register or update repeatable jobs for active workflows
  for (const wf of activeWithGmailTrigger) {
    const jobName = `poll:${wf.id}`;
    const nodes = wf.graph?.nodes || [];
    const triggerNode = nodes.find(
      (n: any) => n.type === 'gmail.trigger' || n.category === 'trigger'
    );
    const pollSeconds = Math.max(30, Number(triggerNode?.config?.pollSeconds) || 60);

    // Check if already registered
    const alreadyRegistered = existingRepeatableJobs.some(
      (j) => j.name === jobName && Number(j.every) === pollSeconds * 1000
    );

    if (!alreadyRegistered) {
      // Add with small random offset so polls don't all hit Gmail at identical seconds (Section 7.10 rule 2)
      const offsetMs = Math.floor(Math.random() * 5000);
      await pollQueue.add(
        jobName,
        { workflowId: wf.id },
        {
          repeat: {
            every: pollSeconds * 1000,
            offset: offsetMs,
          },
          jobId: `repeatable:${wf.id}`,
        }
      );
      logger.info(`Registered repeatable polling job for workflow ${wf.id} every ${pollSeconds}s.`);
      addedCount++;
    }
  }

  logger.info(
    `Reconciliation complete: ${activeWithGmailTrigger.length} active Gmail workflows (${addedCount} added, ${removedCount} removed).`
  );

  return {
    added: addedCount,
    removed: removedCount,
    activeCount: activeWithGmailTrigger.length,
  };
}

import { workflows, triggerState, processedMessages, executions, eq, and } from '@flowcart/db';
import { GmailClient } from '@flowcart/gmail';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { WorkerGmailTokenService } from './gmail-token.service.js';
import { QUEUE_WORKFLOW_EXEC } from './queues.js';

export interface PollerDependencies {
  db: any;
  redis: Redis;
  tokenService: WorkerGmailTokenService;
  execQueue: Queue;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
}

/**
 * Handles a single poll execution for a given workflow (Section 7.10).
 */
export async function handleGmailPollJob(
  workflowId: string,
  deps: PollerDependencies
): Promise<{ polledCount: number; enqueuedCount: number }> {
  const { db, redis, tokenService, execQueue, logger } = deps;

  // 1. Acquire Redis lock per workflow so polls never overlap (Section 7.10 rule 2)
  const lockKey = `lock:poll:${workflowId}`;
  const acquiredLock = await redis.set(lockKey, 'locked', 'PX', 45000, 'NX');
  if (!acquiredLock) {
    logger.info(`Poll for workflow ${workflowId} skipped; another poll job is currently in progress.`);
    return { polledCount: 0, enqueuedCount: 0 };
  }

  try {
    // 2. Load workflow and verify status is 'active'
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    if (!workflow || workflow.status !== 'active') {
      logger.info(`Workflow ${workflowId} is inactive or removed; skipping poll.`);
      return { polledCount: 0, enqueuedCount: 0 };
    }

    if (!workflow.integrationId) {
      logger.warn(`Workflow ${workflowId} has no connected Gmail integration.`);
      return { polledCount: 0, enqueuedCount: 0 };
    }

    // 3. Find gmail.trigger node in graph
    const nodes = workflow.graph?.nodes || [];
    const triggerNode = nodes.find(
      (n: any) => n.type === 'gmail.trigger' || n.category === 'trigger'
    );

    if (!triggerNode || triggerNode.type !== 'gmail.trigger') {
      logger.info(`Workflow ${workflowId} does not have a gmail.trigger node.`);
      return { polledCount: 0, enqueuedCount: 0 };
    }

    const triggerConfig = triggerNode.config || {};
    const skipBulk = triggerConfig.skipBulk !== false;
    const skipOwnMail = triggerConfig.skipOwnMail !== false;
    const ignoredSenders: string[] = Array.isArray(triggerConfig.ignoredSenders)
      ? triggerConfig.ignoredSenders.map((s: string) => s.toLowerCase().trim())
      : [];
    const labelFilterIds: string[] = Array.isArray(triggerConfig.labelIds)
      ? triggerConfig.labelIds
      : ['INBOX'];

    // 4. Authenticate Gmail client
    const authClient = await tokenService.getAuthenticatedClient(
      workflow.integrationId,
      workflow.userId
    );
    const gmailClient = new GmailClient(authClient);

    // Get account profile for cursor init and skipOwnMail address
    const profile = await gmailClient.getProfile();
    const ownEmailAddress = profile.emailAddress.toLowerCase();

    // 5. Read current trigger_state
    const [currentState] = await db
      .select()
      .from(triggerState)
      .where(eq(triggerState.workflowId, workflowId))
      .limit(1);

    // Rule 1: If cursor is not yet set, seed it with profile historyId and return
    // (Only mail that arrives after activation is processed)
    if (!currentState || !currentState.cursor) {
      await db
        .insert(triggerState)
        .values({
          workflowId,
          cursor: profile.historyId,
          lastPolledAt: new Date(),
          lastError: null,
          warning: null,
        })
        .onConflictDoUpdate({
          target: triggerState.workflowId,
          set: {
            cursor: profile.historyId,
            lastPolledAt: new Date(),
          },
        });

      logger.info(
        `Seeded initial historyId cursor ${profile.historyId} for workflow ${workflowId}.`
      );
      return { polledCount: 0, enqueuedCount: 0 };
    }

    let messageIds: string[] = [];
    let nextHistoryId = profile.historyId;

    try {
      // Rule 3: Call listHistory(cursor) for added messages
      const historyResult = await gmailClient.listHistory(currentState.cursor);
      messageIds = historyResult.messageIds;
      nextHistoryId = historyResult.latestHistoryId || profile.historyId;
    } catch (err: any) {
      // Rule 6: If Gmail answers 404 for an old cursor, fall back to listMessages('newer_than:1d')
      const is404 =
        err?.status === 404 ||
        err?.code === 404 ||
        err?.message?.includes('historyId') ||
        err?.message?.includes('not found');

      if (is404) {
        logger.warn(
          `Cursor ${currentState.cursor} expired or not found for workflow ${workflowId}. Falling back to listMessages('newer_than:1d').`
        );
        const searchRes = await gmailClient.listMessages('newer_than:1d', 100);
        messageIds = searchRes.messages.map((m) => m.id);
        nextHistoryId = profile.historyId;
      } else {
        throw err;
      }
    }

    // Rule 7: If more than 100 new messages appear in one poll, enqueue only newest 100
    let warningMessage: string | null = null;
    if (messageIds.length > 100) {
      warningMessage = `More than 100 new messages discovered (${messageIds.length}); processing newest 100.`;
      logger.warn(`[Workflow ${workflowId}] ${warningMessage}`);
      messageIds = messageIds.slice(-100);
    }

    let enqueuedCount = 0;

    // Fetch and process messages
    for (const msgId of messageIds) {
      try {
        const msg = await gmailClient.getMessage(msgId);

        // Rule 8: Mandatory Loop Prevention
        // 8a. Always ignore messages whose sender is the connected account itself
        const senderAddress = (msg.from?.address || '').toLowerCase();
        if (skipOwnMail && senderAddress === ownEmailAddress) {
          logger.info(`Loop prevention: skipped email ${msgId} sent from connected account.`);
          continue;
        }

        // 8b. Always ignore messages with SENT label
        if (msg.labels.includes('SENT')) {
          logger.info(`Loop prevention: skipped email ${msgId} carrying SENT label.`);
          continue;
        }

        // 8c. Always ignore messages that already carry a FlowCart/ label
        const hasFlowCartLabel = msg.labels.some((l) =>
          l.toLowerCase().startsWith('flowcart/')
        );
        if (hasFlowCartLabel) {
          logger.info(`Loop prevention: skipped email ${msgId} carrying FlowCart label.`);
          continue;
        }

        // 8d. When skipBulk is on (default), ignore bulk or automated mail
        if (skipBulk && msg.isBulk) {
          logger.info(`Skipped bulk/automated email ${msgId}.`);
          continue;
        }

        // 8e. Ignore senders matching ignoredSenders
        if (ignoredSenders.some((ign) => senderAddress.includes(ign))) {
          logger.info(`Skipped email ${msgId} from ignored sender ${senderAddress}.`);
          continue;
        }

        // 8f. Filter by labelIds if specified (e.g. INBOX)
        if (labelFilterIds.length > 0) {
          const hasMatchingLabel = labelFilterIds.some((lid) =>
            msg.labels.includes(lid)
          );
          if (!hasMatchingLabel) {
            continue;
          }
        }

        // Rule 4: Deduplicate through processed_messages with ON CONFLICT DO NOTHING
        const insertRes = await db
          .insert(processedMessages)
          .values({
            workflowId,
            gmailMessageId: msg.messageId,
            createdAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();

        // Only enqueue if the insert actually happened (it wasn't processed before)
        if (insertRes && insertRes.length > 0) {
          // Create execution record in DB
          const [execRow] = await db
            .insert(executions)
            .values({
              workflowId,
              userId: workflow.userId,
              mode: 'trigger',
              status: 'queued',
              triggerData: msg,
              createdAt: new Date(),
            })
            .returning();

          // Enqueue BullMQ job with custom guard ID: exec:<workflowId>:<messageId>
          const jobId = `exec:${workflowId}:${msg.messageId}`;
          await execQueue.add(
            QUEUE_WORKFLOW_EXEC,
            {
              executionId: execRow.id,
              workflowId,
              userId: workflow.userId,
              messageId: msg.messageId,
            },
            {
              jobId,
              attempts: 1, // Node-level retry handled by engine
            }
          );

          enqueuedCount++;
        }
      } catch (msgErr: any) {
        logger.error(`Failed to process message ${msgId}: ${msgErr.message}`);
      }
    }

    // Rule 5: Advance cursor only after discovered messages were enqueued
    await db
      .update(triggerState)
      .set({
        cursor: nextHistoryId,
        lastPolledAt: new Date(),
        lastError: null,
        warning: warningMessage,
      })
      .where(eq(triggerState.workflowId, workflowId));

    return { polledCount: messageIds.length, enqueuedCount };
  } catch (err: any) {
    logger.error(`Poller failure for workflow ${workflowId}: ${err.message}`);

    await db
      .update(triggerState)
      .set({
        lastPolledAt: new Date(),
        lastError: err.message,
      })
      .where(eq(triggerState.workflowId, workflowId));

    throw err;
  } finally {
    // Release Redis lock
    try {
      await redis.del(lockKey);
    } catch {}
  }
}

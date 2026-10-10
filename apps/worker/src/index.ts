import 'dotenv/config';
import { Worker } from 'bullmq';
import { validateEnv } from '@flowcart/shared';
import { getDb, usageEvents } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { LLMService, UsageRecord } from '@flowcart/llm';
import pino from 'pino';
import {
  createRedisConnection,
  createWorkerQueues,
  QUEUE_GMAIL_POLL,
  QUEUE_WORKFLOW_EXEC,
  QUEUE_MAINTENANCE,
  QUEUE_MEMORY_EXTRACT,
} from './queues.js';
import { WorkerGmailTokenService } from './gmail-token.service.js';
import { handleGmailPollJob } from './poller.js';
import { handleWorkflowExecJob } from './execution-runner.js';
import { reconcilePollingJobs } from './reconciliation.js';
import { handleMemoryExtractJob } from './memory-extract.js';

const logger = pino({
  name: 'flowcart-worker',
  level: process.env.LOG_LEVEL || 'info',
});

async function bootstrap() {
  const env = validateEnv();
  logger.info(`Starting FlowCart worker [environment: ${env.NODE_ENV}]`);

  const db = getDb(env.DATABASE_URL);
  const redis = createRedisConnection(env);
  const vault = new Vault({
    activeKeyId: env.APP_ENCRYPTION_KEY_ID,
    keys: {
      [env.APP_ENCRYPTION_KEY_ID]: Buffer.from(env.APP_ENCRYPTION_KEY, 'base64'),
    },
  });
  const tokenService = new WorkerGmailTokenService(db, vault, env, redis);
  const llmService = new LLMService(
    {
      defaultProvider: env.LLM_DEFAULT_PROVIDER as any,
      modelAgent: env.LLM_MODEL_AGENT,
      modelFast: env.LLM_MODEL_FAST,
      embeddingProvider: env.EMBEDDING_PROVIDER,
      embeddingModel: env.EMBEDDING_MODEL,
      embeddingDim: env.EMBEDDING_DIM,
      openaiApiKey: env.OPENAI_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      googleApiKey: env.GOOGLE_API_KEY,
      ollamaBaseUrl: env.OLLAMA_BASE_URL,
      timeoutMs: env.AGENT_RUN_TIMEOUT_MS,
    },
    async (record: UsageRecord) => {
      if (record.userId) {
        try {
          await db.insert(usageEvents).values({
            userId: record.userId,
            provider: record.provider,
            model: record.model,
            purpose: record.purpose,
            tokensIn: record.tokensIn,
            tokensOut: record.tokensOut,
            at: new Date(),
          });
        } catch {
          // Non-fatal usage record logging
        }
      }
    }
  );

  const { pollQueue, execQueue, maintQueue, memoryQueue } = createWorkerQueues(redis);

  // 1. Initial reconciliation on startup (Section 14)
  try {
    await reconcilePollingJobs({
      db,
      pollQueue,
      logger,
    });
  } catch (err: any) {
    logger.error(`Initial reconciliation failed: ${err.message}`);
  }

  // 2. Setup 10-minute maintenance interval (Section 14)
  const maintenanceInterval = setInterval(async () => {
    try {
      logger.info('Running scheduled 10-minute workflow polling reconciliation...');
      await reconcilePollingJobs({
        db,
        pollQueue,
        logger,
      });
    } catch (err: any) {
      logger.error(`Maintenance reconciliation error: ${err.message}`);
    }
  }, 10 * 60 * 1000);

  // 3. Worker for gmail-poll (Concurrency 5 per Section 14)
  const pollWorker = new Worker(
    QUEUE_GMAIL_POLL,
    async (job) => {
      const workflowId = job.data?.workflowId;
      if (!workflowId) return;

      const startTime = Date.now();
      logger.info(`[Job ${job.id}] Starting Gmail poll for workflow ${workflowId}`);

      const result = await handleGmailPollJob(workflowId, {
        db,
        redis,
        tokenService,
        execQueue,
        logger,
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        `[Job ${job.id}] Finished Gmail poll in ${durationMs}ms (polled: ${result.polledCount}, queued: ${result.enqueuedCount})`
      );
      return result;
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  // 4. Worker for workflow-exec (Concurrency 5 per Section 14)
  const execWorker = new Worker(
    QUEUE_WORKFLOW_EXEC,
    async (job) => {
      const startTime = Date.now();
      logger.info(`[Job ${job.id}] Running execution ${job.data?.executionId}`);

      const result = await handleWorkflowExecJob(job.data, {
        db,
        tokenService,
        llmService,
        logger,
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        `[Job ${job.id}] Finished execution in ${durationMs}ms (status: ${result.status})`
      );
      return result;
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  // 5. Worker for memory-extract (Concurrency 2 per Section 14)
  const memoryWorker = new Worker(
    QUEUE_MEMORY_EXTRACT,
    async (job) => {
      const startTime = Date.now();
      logger.info(`[Job ${job.id}] Running memory extraction for user ${job.data?.userId}`);

      const result = await handleMemoryExtractJob(job.data, {
        db,
        llmService,
        logger,
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        `[Job ${job.id}] Finished memory extraction in ${durationMs}ms (extracted: ${result.extractedCount})`
      );
      return result;
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  // Worker error handlers
  pollWorker.on('failed', (job, err) => {
    logger.error(`[Poll Worker Job ${job?.id}] Failed: ${err.message}`);
  });

  execWorker.on('failed', (job, err) => {
    logger.error(`[Exec Worker Job ${job?.id}] Failed: ${err.message}`);
  });

  memoryWorker.on('failed', (job, err) => {
    logger.error(`[Memory Worker Job ${job?.id}] Failed: ${err.message}`);
  });

  // 6. Graceful shutdown handler (Section 14)
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker gracefully...`);
    clearInterval(maintenanceInterval);

    await Promise.allSettled([
      pollWorker.close(),
      execWorker.close(),
      memoryWorker.close(),
      pollQueue.close(),
      execQueue.close(),
      maintQueue.close(),
      memoryQueue.close(),
    ]);

    await redis.quit();
    logger.info('Worker shutdown completed.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('FlowCart background workers active and listening for jobs.');
}

bootstrap().catch((err) => {
  logger.error(`Fatal worker bootstrap error: ${err.message}`);
  process.exit(1);
});

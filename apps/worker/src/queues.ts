import { Queue, QueueOptions } from 'bullmq';
import { Env } from '@flowcart/shared';
import { Redis } from 'ioredis';

export const QUEUE_GMAIL_POLL = 'gmail-poll';
export const QUEUE_WORKFLOW_EXEC = 'workflow-exec';
export const QUEUE_MAINTENANCE = 'maintenance';
export const QUEUE_MEMORY_EXTRACT = 'memory-extract';

export function createRedisConnection(env: Env): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function createWorkerQueues(redis: Redis) {
  const queueOpts: QueueOptions = {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 }, // Failed jobs kept 7 days (Section 14)
    },
  };

  const pollQueue = new Queue(QUEUE_GMAIL_POLL, queueOpts);
  const execQueue = new Queue(QUEUE_WORKFLOW_EXEC, queueOpts);
  const maintQueue = new Queue(QUEUE_MAINTENANCE, queueOpts);
  const memoryQueue = new Queue(QUEUE_MEMORY_EXTRACT, queueOpts);

  return {
    pollQueue,
    execQueue,
    maintQueue,
    memoryQueue,
  };
}

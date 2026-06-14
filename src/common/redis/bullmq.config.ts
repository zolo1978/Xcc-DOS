import type { ConnectionOptions } from 'bullmq';

export const OUTBOX_QUEUE_NAME = 'xcdos.outbox';
export const OUTBOX_DLQ_NAME = 'xcdos.outbox.dlq';

export function getOutboxQueueName(): string {
  return process.env.OUTBOX_QUEUE_NAME || OUTBOX_QUEUE_NAME;
}

export function getOutboxDlqName(): string {
  return process.env.OUTBOX_DLQ_NAME || OUTBOX_DLQ_NAME;
}

export function createBullmqConnection(): ConnectionOptions {
  const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const dbPath = redisUrl.pathname.replace('/', '');

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: dbPath ? Number(dbPath) : 0,
    maxRetriesPerRequest: null,
  };
}

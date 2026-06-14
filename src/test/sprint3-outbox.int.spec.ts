import { Queue } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OutboxRelay } from '../common/outbox/outbox.relay';
import { OutboxConsumerDeduper } from '../common/outbox/outbox-consumer-deduper';
import { getOutboxQueueName } from '../common/redis/bullmq.config';
import {
  createIntApp,
  drainQueues,
  seedTenant,
  truncateAll,
} from './test-utils.int';

describe('Sprint 3 outbox integration', () => {
  let app: Awaited<ReturnType<typeof createIntApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await createIntApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await drainQueues();
    await seedTenant(prisma);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('relays outbox events to BullMQ and deduplicates consumption', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: 'feedback.submitted',
        aggregateType: 'task',
        aggregateId: crypto.randomUUID(),
        payload: { tenantId: 'tenant-a', feedbackId: crypto.randomUUID() },
      },
    });

    const relay = app.get(OutboxRelay);
    await relay.relayBatch('relay-int', 10);

    const queue = new Queue(getOutboxQueueName(), {
      connection: {
        url: process.env.REDIS_URL,
        maxRetriesPerRequest: null,
      },
    } as never);

    const job = await queue.getJob(event.eventId);
    expect(job).not.toBeNull();
    expect(job?.data.eventId).toBe(event.eventId);

    const deduper = app.get(OutboxConsumerDeduper);
    await deduper.markConsumed('worker-a', event.eventId);
    await expect(deduper.markConsumed('worker-a', event.eventId)).rejects.toHaveProperty(
      'status',
      409,
    );

    await queue.close();
  });
});

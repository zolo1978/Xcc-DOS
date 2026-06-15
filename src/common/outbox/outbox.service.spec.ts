import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('OutboxService', () => {
  const prisma = {
    outboxEvent: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    outboxConsumed: {
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueue writes the event through the provided transaction client', async () => {
    const { OutboxService } = await import('./outbox.service');
    prisma.outboxEvent.create.mockResolvedValue({
      eventId: '018f0f62-0d4e-7b1a-9f0f-5f2cb4de0001',
    });
    const service = new OutboxService(prisma as never);

    await service.enqueue(
      prisma as never,
      {
        tenantId: 'tenant-1',
        eventType: 'feedback.submitted',
        aggregateType: 'task',
        aggregateId: 'task-1',
        payload: { feedbackId: 'feedback-1' },
      },
    );

    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('claimBatch uses SKIP LOCKED polling SQL', async () => {
    const { OutboxRelay } = await import('./outbox.relay');
    prisma.$queryRaw.mockResolvedValue([]);
    const relay = new OutboxRelay(prisma as never, { publish: vi.fn() } as never);

    await relay.claimBatch('relay-1', 10);

    const sqlFragments = prisma.$queryRaw.mock.calls[0]?.[0];
    expect(Array.isArray(sqlFragments) ? sqlFragments.join(' ') : String(sqlFragments)).toContain(
      'FOR UPDATE SKIP LOCKED',
    );
  });

  it('markConsumed surfaces unique constraint conflicts for deduplication', async () => {
    const { OutboxConsumerDeduper } = await import('./outbox-consumer-deduper');
    prisma.outboxConsumed.create.mockRejectedValue({
      code: 'P2002',
    });
    const deduper = new OutboxConsumerDeduper(prisma as never);

    await expect(
      deduper.markConsumed('consumer-1', 'event-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'OUTBOX_EVENT_ALREADY_CONSUMED',
      },
    });
  });
});

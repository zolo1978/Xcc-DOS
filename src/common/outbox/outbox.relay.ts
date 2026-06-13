import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OUTBOX_PUBLISHER } from './outbox.tokens';
import { OutboxPublisher } from './outbox.publisher';
import { ClaimedOutboxEvent } from './outbox.types';

const MAX_RETRIES = 5;

@Injectable()
export class OutboxRelay {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_PUBLISHER) private readonly publisher: OutboxPublisher,
  ) {}

  async claimBatch(lockedBy: string, limit: number): Promise<ClaimedOutboxEvent[]> {
    return this.prisma.$queryRaw<ClaimedOutboxEvent[]>`
      WITH claimed AS (
        SELECT event_id
        FROM outbox_events
        WHERE status IN ('pending', 'retry')
          AND next_attempt_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE outbox_events o
      SET locked_at = now(),
          locked_by = ${lockedBy}
      FROM claimed
      WHERE o.event_id = claimed.event_id
      RETURNING o.event_id, o.event_type, o.event_version, o.aggregate_type, o.aggregate_id, o.payload, o.attempt_count
    `;
  }

  async relayBatch(lockedBy: string, limit: number): Promise<void> {
    const events = await this.claimBatch(lockedBy, limit);

    for (const event of events) {
      try {
        await this.publisher.publish({
          eventId: event.event_id,
          eventType: event.event_type,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          payload: event.payload,
        });

        await this.prisma.outboxEvent.update({
          where: {
            eventId: event.event_id,
          },
          data: {
            status: 'published',
            publishedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        });
      } catch (error) {
        const nextAttemptCount = event.attempt_count + 1;
        const isDead = nextAttemptCount > MAX_RETRIES;
        const delayMinutes = Math.max(1, 2 ** event.attempt_count);

        await this.prisma.outboxEvent.update({
          where: {
            eventId: event.event_id,
          },
          data: {
            status: isDead ? 'dead' : 'retry',
            attemptCount: {
              increment: 1,
            },
            nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
            lockedAt: null,
            lockedBy: null,
            lastError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}

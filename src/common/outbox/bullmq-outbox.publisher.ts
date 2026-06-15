import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { OUTBOX_DLQ_QUEUE, OUTBOX_PUBLISHER_QUEUE } from './outbox.tokens';
import { OutboxPublisher } from './outbox.publisher';

type PublishPayload = Parameters<OutboxPublisher['publish']>[0];

@Injectable()
export class BullmqOutboxPublisher implements OutboxPublisher, OnModuleDestroy {
  constructor(
    @Inject(OUTBOX_PUBLISHER_QUEUE) private readonly queue: Queue,
    @Inject(OUTBOX_DLQ_QUEUE) private readonly dlqQueue: Queue,
  ) {}

  async publish(event: PublishPayload): Promise<void> {
    await this.queue.add(event.eventType, event, {
      jobId: event.eventId,
      removeOnComplete: false,
      removeOnFail: false,
    });
  }

  async publishDeadLetter(
    event: PublishPayload,
    errorMessage: string,
  ): Promise<void> {
    await this.dlqQueue.add(
      event.eventType,
      { ...event, errorMessage },
      {
        jobId: event.eventId,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.queue.close(), this.dlqQueue.close()]);
  }
}

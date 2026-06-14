import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  createBullmqConnection,
  getOutboxDlqName,
  getOutboxQueueName,
} from '../redis/bullmq.config';
import { PrismaModule } from '../../prisma/prisma.module';
import { BullmqOutboxPublisher } from './bullmq-outbox.publisher';
import { InMemoryOutboxPublisher } from './in-memory-outbox.publisher';
import { OutboxConsumerDeduper } from './outbox-consumer-deduper';
import { OutboxRelay } from './outbox.relay';
import { OutboxService } from './outbox.service';
import {
  OUTBOX_DLQ_QUEUE,
  OUTBOX_PUBLISHER,
  OUTBOX_PUBLISHER_QUEUE,
} from './outbox.tokens';

@Module({
  imports: [PrismaModule],
  providers: [
    OutboxService,
    OutboxRelay,
    OutboxConsumerDeduper,
    InMemoryOutboxPublisher,
    BullmqOutboxPublisher,
    {
      provide: OUTBOX_PUBLISHER_QUEUE,
      useFactory: () =>
        new Queue(getOutboxQueueName(), {
          connection: createBullmqConnection(),
        }),
    },
    {
      provide: OUTBOX_DLQ_QUEUE,
      useFactory: () =>
        new Queue(getOutboxDlqName(), {
          connection: createBullmqConnection(),
        }),
    },
    {
      provide: OUTBOX_PUBLISHER,
      useExisting: BullmqOutboxPublisher,
    },
  ],
  exports: [OutboxService, OutboxRelay, OutboxConsumerDeduper, OUTBOX_PUBLISHER],
})
export class OutboxModule {}

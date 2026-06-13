import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InMemoryOutboxPublisher } from './in-memory-outbox.publisher';
import { OutboxConsumerDeduper } from './outbox-consumer-deduper';
import { OutboxRelay } from './outbox.relay';
import { OutboxService } from './outbox.service';
import { OUTBOX_PUBLISHER } from './outbox.tokens';

@Module({
  imports: [PrismaModule],
  providers: [
    OutboxService,
    OutboxRelay,
    OutboxConsumerDeduper,
    InMemoryOutboxPublisher,
    {
      provide: OUTBOX_PUBLISHER,
      useExisting: InMemoryOutboxPublisher,
    },
  ],
  exports: [OutboxService, OutboxRelay, OutboxConsumerDeduper, OUTBOX_PUBLISHER],
})
export class OutboxModule {}

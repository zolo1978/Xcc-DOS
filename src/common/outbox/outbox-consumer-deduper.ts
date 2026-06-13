import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxConsumerDeduper {
  constructor(private readonly prisma: PrismaService) {}

  async markConsumed(consumerName: string, eventId: string): Promise<void> {
    try {
      await this.prisma.outboxConsumed.create({
        data: {
          consumerName,
          eventId,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'OUTBOX_EVENT_ALREADY_CONSUMED',
          message: 'Outbox event has already been consumed',
        });
      }

      throw error;
    }
  }
}

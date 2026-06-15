import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxEventEnvelope } from './outbox.types';

type OutboxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(client: OutboxClient, event: OutboxEventEnvelope) {
    return client.outboxEvent.create({
      data: {
        eventId: uuidv7(),
        eventType: event.eventType,
        eventVersion: event.eventVersion ?? 1,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: {
          tenantId: event.tenantId,
          ...event.payload,
        },
        status: 'pending',
      },
    });
  }

  getPrisma(): PrismaService {
    return this.prisma;
  }
}

import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from './outbox.publisher';

@Injectable()
export class InMemoryOutboxPublisher implements OutboxPublisher {
  readonly published: Array<{
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }> = [];

  async publish(event: {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    this.published.push(event);
  }
}

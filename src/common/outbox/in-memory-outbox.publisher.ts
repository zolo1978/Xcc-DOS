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
  readonly deadLetters: Array<{
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    errorMessage: string;
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

  async publishDeadLetter(
    event: {
      eventId: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
    },
    errorMessage: string,
  ): Promise<void> {
    this.deadLetters.push({ ...event, errorMessage });
  }
}

export interface OutboxPublisher {
  publish(event: {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  publishDeadLetter?(event: {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }, errorMessage: string): Promise<void>;
}

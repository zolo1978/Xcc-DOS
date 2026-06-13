export type OutboxStatus = 'pending' | 'retry' | 'published' | 'dead';

export type OutboxEventEnvelope = {
  tenantId: string;
  eventType: string;
  eventVersion?: number;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export type ClaimedOutboxEvent = {
  event_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

export type EventType =
  | "ENTITY_CREATED"
  | "ENTITY_UPDATED"
  | "ENTITY_DELETED"
  | "STAGE_CHANGED"
  | "OWNER_CHANGED"
  | "VALUE_CHANGED"
  | "STATUS_CHANGED"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_REOPENED"
  | "ACTIVITY_CREATED"
  | "NOTE_CREATED"
  | "DEAL_CREATED"
  | "LEAD_CREATED"
  | "CUSTOMER_CREATED";

export type EntityType =
  | "customer"
  | "lead"
  | "deal"
  | "task"
  | "activity"
  | "note"
  | "user";

export type EventSource =
  | "ai_action"
  | "api"
  | "ui"
  | "system"
  | "replay";

export interface CrmEvent {
  id: string;
  event_type: EventType;
  entity_type: EntityType;
  entity_id: string;
  actor_id: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  correlation_id: string | null;
  source: EventSource | null;
}

export interface RecordEventInput {
  event_type: EventType;
  entity_type: EntityType;
  entity_id: string;
  actor_id?: string | null;
  metadata?: Record<string, unknown> | null;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  correlation_id?: string | null;
  source?: EventSource | null;
}

export interface EventFilter {
  entity_type?: EntityType;
  entity_id?: string;
  event_type?: EventType;
  actor_id?: string;
  before?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

export interface StateChange {
  field: string;
  from: unknown;
  to: unknown;
}

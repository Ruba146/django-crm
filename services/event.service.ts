import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type { CrmEvent, EntityType, EventFilter, EventSource, RecordEventInput } from "@/types/events";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function serializeJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/* ------------------------------------------------------------------ */
/* Core CRUD                                                           */
/* ------------------------------------------------------------------ */

export function recordEvent(input: RecordEventInput): CrmEvent {
  const db = getDb();
  const id = `evt_${uuid()}`;
  const timestamp = now();

  const actorId = input.actor_id ?? null;
  const metadata = serializeJson(input.metadata ?? null);
  const previousState = serializeJson(input.previous_state ?? null);
  const newState = serializeJson(input.new_state ?? null);
  const correlationId = input.correlation_id ?? null;
  const source = input.source ?? null;

  db.prepare(
    `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.event_type, input.entity_type, input.entity_id, actorId, timestamp, metadata, previousState, newState, correlationId, source);

  return {
    id,
    event_type: input.event_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    actor_id: actorId,
    timestamp,
    metadata: input.metadata ?? null,
    previous_state: input.previous_state ?? null,
    new_state: input.new_state ?? null,
    correlation_id: correlationId,
    source: source as EventSource | null,
  };
}

export function getEvent(id: string): CrmEvent | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source
     FROM ${TABLES.events} WHERE id = ? LIMIT 1`
  ).get(id) as
    | {
        id: string;
        event_type: string;
        entity_type: string;
        entity_id: string;
        actor_id: string | null;
        timestamp: string;
        metadata: string | null;
        previous_state: string | null;
        new_state: string | null;
        correlation_id: string | null;
        source: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    event_type: row.event_type as CrmEvent["event_type"],
    entity_type: row.entity_type as EntityType,
    entity_id: row.entity_id,
    actor_id: row.actor_id,
    timestamp: row.timestamp,
    metadata: parseJson(row.metadata, null),
    previous_state: parseJson(row.previous_state, null),
    new_state: parseJson(row.new_state, null),
    correlation_id: row.correlation_id,
    source: row.source as EventSource | null,
  };
}

export function getEntityEvents(entityType: EntityType, entityId: string, limit = 100): CrmEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source
       FROM ${TABLES.events}
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY timestamp ASC
       LIMIT ?`
    )
    .all(entityType, entityId, limit) as Array<{
      id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      actor_id: string | null;
      timestamp: string;
      metadata: string | null;
      previous_state: string | null;
      new_state: string | null;
      correlation_id: string | null;
      source: string | null;
    }>;

  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type as CrmEvent["event_type"],
    entity_type: r.entity_type as EntityType,
    entity_id: r.entity_id,
    actor_id: r.actor_id,
    timestamp: r.timestamp,
    metadata: parseJson(r.metadata, null),
    previous_state: parseJson(r.previous_state, null),
    new_state: parseJson(r.new_state, null),
    correlation_id: r.correlation_id,
    source: r.source as EventSource | null,
  }));
}

export function getEventsByType(eventType: CrmEvent["event_type"], limit = 100): CrmEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source
       FROM ${TABLES.events}
       WHERE event_type = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(eventType, limit) as Array<{
      id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      actor_id: string | null;
      timestamp: string;
      metadata: string | null;
      previous_state: string | null;
      new_state: string | null;
      correlation_id: string | null;
      source: string | null;
    }>;

  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type as CrmEvent["event_type"],
    entity_type: r.entity_type as EntityType,
    entity_id: r.entity_id,
    actor_id: r.actor_id,
    timestamp: r.timestamp,
    metadata: parseJson(r.metadata, null),
    previous_state: parseJson(r.previous_state, null),
    new_state: parseJson(r.new_state, null),
    correlation_id: r.correlation_id,
    source: r.source as EventSource | null,
  }));
}

export function getEventsInRange(filter: EventFilter): CrmEvent[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.entity_type) {
    conditions.push(`entity_type = ?`);
    params.push(filter.entity_type);
  }
  if (filter.entity_id) {
    conditions.push(`entity_id = ?`);
    params.push(filter.entity_id);
  }
  if (filter.event_type) {
    conditions.push(`event_type = ?`);
    params.push(filter.event_type);
  }
  if (filter.actor_id) {
    conditions.push(`actor_id = ?`);
    params.push(filter.actor_id);
  }
  if (filter.after) {
    conditions.push(`timestamp >= ?`);
    params.push(filter.after);
  }
  if (filter.before) {
    conditions.push(`timestamp <= ?`);
    params.push(filter.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source
       FROM ${TABLES.events}
       ${where}
       ORDER BY timestamp ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
      id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      actor_id: string | null;
      timestamp: string;
      metadata: string | null;
      previous_state: string | null;
      new_state: string | null;
      correlation_id: string | null;
      source: string | null;
    }>;

  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type as CrmEvent["event_type"],
    entity_type: r.entity_type as EntityType,
    entity_id: r.entity_id,
    actor_id: r.actor_id,
    timestamp: r.timestamp,
    metadata: parseJson(r.metadata, null),
    previous_state: parseJson(r.previous_state, null),
    new_state: parseJson(r.new_state, null),
    correlation_id: r.correlation_id,
    source: r.source as EventSource | null,
  }));
}

export function getEventsByCorrelationId(correlationId: string): CrmEvent[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source
       FROM ${TABLES.events}
       WHERE correlation_id = ?
       ORDER BY timestamp ASC`
    )
    .all(correlationId) as Array<{
      id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      actor_id: string | null;
      timestamp: string;
      metadata: string | null;
      previous_state: string | null;
      new_state: string | null;
      correlation_id: string | null;
      source: string | null;
    }>;

  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type as CrmEvent["event_type"],
    entity_type: r.entity_type as EntityType,
    entity_id: r.entity_id,
    actor_id: r.actor_id,
    timestamp: r.timestamp,
    metadata: parseJson(r.metadata, null),
    previous_state: parseJson(r.previous_state, null),
    new_state: parseJson(r.new_state, null),
    correlation_id: r.correlation_id,
    source: r.source as EventSource | null,
  }));
}

export function countEvents(filter: EventFilter): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.entity_type) {
    conditions.push(`entity_type = ?`);
    params.push(filter.entity_type);
  }
  if (filter.entity_id) {
    conditions.push(`entity_id = ?`);
    params.push(filter.entity_id);
  }
  if (filter.event_type) {
    conditions.push(`event_type = ?`);
    params.push(filter.event_type);
  }
  if (filter.actor_id) {
    conditions.push(`actor_id = ?`);
    params.push(filter.actor_id);
  }
  if (filter.after) {
    conditions.push(`timestamp >= ?`);
    params.push(filter.after);
  }
  if (filter.before) {
    conditions.push(`timestamp <= ?`);
    params.push(filter.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.events} ${where}`).get(...params) as { count: number };
  return Number(row?.count ?? 0);
}

import { NextResponse } from "next/server";
import { countEvents, getEventsInRange, recordEvent } from "@/services/event.service";
import { initEventTables } from "@/scripts/init-event-tables";
import type { EntityType, EventType } from "@/types/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  initEventTables();

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type") as EntityType | null;
  const entityId = url.searchParams.get("entity_id");
  const eventType = url.searchParams.get("event_type") as EventType | null;
  const actorId = url.searchParams.get("actor_id");
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const validEntityTypes = ["customer", "lead", "deal", "task", "activity", "note", "user"] as const;
  if (entityType && !validEntityTypes.includes(entityType)) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  if (entityType && !entityId) {
    return NextResponse.json({ error: "Missing entity_id" }, { status: 400 });
  }

  const filter = {
    entity_type: entityType ?? undefined,
    entity_id: entityId ?? undefined,
    event_type: eventType ?? undefined,
    actor_id: actorId ?? undefined,
    after: after ?? undefined,
    before: before ?? undefined,
    limit: Math.min(limit, 200),
    offset,
  };

  const events = getEventsInRange(filter);
  const total = countEvents(filter);

  return NextResponse.json({ events, total, limit, offset });
}

export async function POST(request: Request) {
  initEventTables();

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { event_type, entity_type, entity_id, actor_id, metadata, previous_state, new_state, correlation_id, source } = body;

  if (!event_type || !entity_type || !entity_id) {
    return NextResponse.json({ error: "Missing required fields: event_type, entity_type, entity_id" }, { status: 400 });
  }

  const validEntityTypes = ["customer", "lead", "deal", "task", "activity", "note", "user"] as const;
  if (!validEntityTypes.includes(entity_type as typeof validEntityTypes[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  const event = recordEvent({
    event_type: event_type as EventType,
    entity_type: entity_type as EntityType,
    entity_id,
    actor_id: actor_id ?? null,
    metadata,
    previous_state,
    new_state,
    correlation_id,
    source: source ?? "api",
  });

  return NextResponse.json({ event }, { status: 201 });
}

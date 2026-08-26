import { NextResponse } from "next/server";
import { getEntityEvents } from "@/services/event.service";
import { initEventTables } from "@/scripts/init-event-tables";
import type { EntityType } from "@/types/events";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity_type: string; entity_id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  initEventTables();

  const { entity_type, entity_id } = await context.params;

  const validEntityTypes = ["customer", "lead", "deal", "task", "activity", "note", "user"] as const;
  if (!validEntityTypes.includes(entity_type as typeof validEntityTypes[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  const events = getEntityEvents(entity_type as EntityType, entity_id, 200);

  return NextResponse.json({ events });
}

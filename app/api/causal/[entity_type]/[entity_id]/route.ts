import { NextResponse } from "next/server";
import { analyzeCausality } from "@/services/causal.service";
import type { EntityType } from "@/types/events";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity_type: string; entity_id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { entity_type, entity_id } = await context.params;

  const validEntityTypes = ["customer", "lead", "deal", "task", "activity", "note", "user"] as const;
  if (!validEntityTypes.includes(entity_type as typeof validEntityTypes[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  const url = new URL(_request.url);
  const targetEventId = url.searchParams.get("target_event_id") ?? undefined;
  const lookbackDays = Number(url.searchParams.get("lookback_days") ?? 90);

  const analysis = analyzeCausality({
    entityType: entity_type as EntityType,
    entityId: entity_id,
    targetEventId,
    lookbackDays,
  });

  return NextResponse.json({ analysis });
}

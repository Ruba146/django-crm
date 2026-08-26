import { NextResponse } from "next/server";
import { generateDigitalTwin } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityType: string; entityId: string }> };

const VALID_ENTITY_TYPES = ["customer", "lead", "deal", "user", "process", "task", "activity", "note"] as const;

export async function GET(_request: Request, context: RouteContext) {
  const { entityType, entityId } = await context.params;

  if (!VALID_ENTITY_TYPES.includes(entityType as typeof VALID_ENTITY_TYPES[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  const url = new URL(_request.url);
  const lookbackDays = Number(url.searchParams.get("lookback_days") ?? 90);

  const snapshot = generateDigitalTwin({
    entityType: entityType as "customer" | "lead" | "deal" | "user" | "process" | "task" | "activity" | "note",
    entityId,
    lookbackDays,
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

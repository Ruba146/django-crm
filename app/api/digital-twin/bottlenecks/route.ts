import { NextResponse } from "next/server";
import { getBottlenecks } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const entityType = url.searchParams.get("entity_type") ?? undefined;
  const entityId = url.searchParams.get("entity_id") ?? undefined;
  const lookbackDays = Number(url.searchParams.get("lookback_days") ?? 90);

  if (entityType && entityId) {
    const validEntityTypes = ["customer", "lead", "deal", "user", "process", "task", "activity", "note"] as const;
    if (!validEntityTypes.includes(entityType as typeof validEntityTypes[number])) {
      return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
    }

    const bottlenecks = getBottlenecks({
      entityType: entityType as "customer" | "lead" | "deal" | "user" | "process" | "task" | "activity" | "note",
      entityId,
      lookbackDays,
    });

    return NextResponse.json({ bottlenecks, entityType, entityId });
  }

  return NextResponse.json({ error: "entity_type and entity_id are required" }, { status: 400 });
}

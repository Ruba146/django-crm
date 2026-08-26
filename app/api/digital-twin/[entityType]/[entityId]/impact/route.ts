import { NextResponse } from "next/server";
import { getImpactMap } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityType: string; entityId: string }> };

const VALID_ENTITY_TYPES = ["customer", "lead", "deal", "user", "process"] as const;

export async function GET(_request: Request, context: RouteContext) {
  const { entityType, entityId } = await context.params;

  if (!VALID_ENTITY_TYPES.includes(entityType as typeof VALID_ENTITY_TYPES[number])) {
    return NextResponse.json({ error: "Invalid entity_type for impact map" }, { status: 400 });
  }

  const impactMap = getImpactMap(entityType, entityId);

  if (!impactMap) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json({ impactMap });
}

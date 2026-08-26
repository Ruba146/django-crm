import { NextResponse } from "next/server";
import { getRelationshipIntelligence } from "@/services/relationship-intelligence.service";

export const dynamic = "force-dynamic";

const VALID_ENTITY_TYPES = ["customer", "lead", "deal"] as const;

export async function GET(_request: Request, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await context.params;

  if (!VALID_ENTITY_TYPES.includes(entityType as typeof VALID_ENTITY_TYPES[number])) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const intelligence = getRelationshipIntelligence(entityType as typeof VALID_ENTITY_TYPES[number], entityId);

  if (!intelligence) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json(intelligence);
}

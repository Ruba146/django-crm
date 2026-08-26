import { NextResponse } from "next/server";
import { createMemory, getMemories } from "@/services/graph.service";
import type { EntityType } from "@/types/graph";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const entityType = url.searchParams.get("entity_type");
  const entityId = url.searchParams.get("entity_id");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Missing entity_type or entity_id" }, { status: 400 });
  }

  const validTypes = ["customer", "lead", "deal", "task", "activity", "user", "contact"] as const;
  if (!validTypes.includes(entityType as typeof validTypes[number])) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const memories = getMemories(entityType as EntityType, entityId);
  return NextResponse.json({ memories });
}

export async function POST(_request: Request) {
  const body = await _request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { entity_type, entity_id, memory_type, content, metadata, source, created_by } = body;

  if (!entity_type || !entity_id || !memory_type || !content) {
    return NextResponse.json({ error: "Missing required fields: entity_type, entity_id, memory_type, content" }, { status: 400 });
  }

  const validTypes = ["customer", "lead", "deal", "task", "activity", "user", "contact"] as const;
  const validMemoryTypes = ["decision", "context", "lesson", "note"] as const;

  if (!validTypes.includes(entity_type as typeof validTypes[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }
  if (!validMemoryTypes.includes(memory_type as typeof validMemoryTypes[number])) {
    return NextResponse.json({ error: "Invalid memory_type" }, { status: 400 });
  }

  const memory = createMemory({
    entity_type: entity_type as EntityType,
    entity_id,
    memory_type: memory_type as typeof validMemoryTypes[number],
    content,
    metadata,
    source,
    created_by,
  });

  return NextResponse.json({ memory }, { status: 201 });
}

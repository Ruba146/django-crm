import { NextResponse } from "next/server";
import { deleteMemory, getMemory, updateMemory } from "@/services/graph.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const memory = getMemory(id);
  if (!memory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ memory });
}

export async function PUT(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await _request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { memory_type, content, metadata, source } = body;

  const validMemoryTypes = ["decision", "context", "lesson", "note"] as const;

  if (memory_type && !validMemoryTypes.includes(memory_type as typeof validMemoryTypes[number])) {
    return NextResponse.json({ error: "Invalid memory_type" }, { status: 400 });
  }

  const updated = updateMemory(id, {
    memory_type: memory_type as typeof validMemoryTypes[number] | undefined,
    content,
    metadata,
    source,
  });

  if (!updated) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  return NextResponse.json({ memory: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteMemory(id);
  if (!deleted) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

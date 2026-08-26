import { NextResponse } from "next/server";
import { startProcess, getProcessInstances } from "@/services/process.service";
import type { ProcessInstanceStatus } from "@/types/process";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const definitionId = url.searchParams.get("definition_id") || undefined;
  const entityType = url.searchParams.get("entity_type") || undefined;
  const entityId = url.searchParams.get("entity_id") || undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? (statusParam as ProcessInstanceStatus) : undefined;

  const instances = getProcessInstances({
    definitionId,
    entityType,
    entityId,
    status,
  });

  return NextResponse.json({ instances });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { definitionId: string; entityType: string; entityId: string; actorId?: string; context?: Record<string, unknown>; correlationId?: string };
    const { definitionId, entityType, entityId, actorId, context, correlationId } = body;

    if (!definitionId || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields: definitionId, entityType, entityId" }, { status: 400 });
    }

    const instance = startProcess({ definitionId, entityType, entityId, actorId, context, correlationId });
    return NextResponse.json({ instance }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start process" }, { status: 500 });
  }
}

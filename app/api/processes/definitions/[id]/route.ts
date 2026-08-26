import { NextResponse } from "next/server";
import { getProcessDefinition, updateProcessDefinition, deleteProcessDefinition } from "@/services/process.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const definition = getProcessDefinition(id);
  if (!definition) {
    return NextResponse.json({ error: "Process definition not found" }, { status: 404 });
  }
  return NextResponse.json({ definition });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const definition = updateProcessDefinition(id, body);
    if (!definition) {
      return NextResponse.json({ error: "Process definition not found" }, { status: 404 });
    }
    return NextResponse.json({ definition });
  } catch {
    return NextResponse.json({ error: "Failed to update process definition" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteProcessDefinition(id);
  if (!deleted) {
    return NextResponse.json({ error: "Process definition not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

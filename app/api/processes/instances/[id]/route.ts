import { NextResponse } from "next/server";
import { getProcessInstance, executeProcess, cancelProcess } from "@/services/process.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const instance = getProcessInstance(id);
  if (!instance) {
    return NextResponse.json({ error: "Process instance not found" }, { status: 404 });
  }
  return NextResponse.json({ instance });
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const instance = getProcessInstance(id);
  if (!instance) {
    return NextResponse.json({ error: "Process instance not found" }, { status: 404 });
  }

  try {
    const body = await _request.json() as { action?: string };
    const action = body.action;

    if (action === "cancel") {
      const updated = cancelProcess(id);
      return NextResponse.json({ instance: updated });
    }

    if (action === "execute") {
      const executions = executeProcess(id);
      const updated = getProcessInstance(id);
      return NextResponse.json({ executions, instance: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use 'execute' or 'cancel'." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}

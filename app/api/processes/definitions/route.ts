import { NextResponse } from "next/server";
import { createProcessDefinition, getProcessDefinitions } from "@/services/process.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const definitions = getProcessDefinitions();
  return NextResponse.json({ definitions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, trigger, nodes, edges } = body;

    if (!name || !trigger || !nodes || !edges) {
      return NextResponse.json({ error: "Missing required fields: name, trigger, nodes, edges" }, { status: 400 });
    }

    const definition = createProcessDefinition({ name, description, trigger, nodes, edges });
    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create process definition" }, { status: 500 });
  }
}

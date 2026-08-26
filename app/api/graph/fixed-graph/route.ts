import { NextResponse } from "next/server";
import { getFixedGraphData } from "@/services/graph.service";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["customer", "lead", "deal", "task", "activity", "user", "contact", "note", "source", "stage", "industry", "event", "task_type", "activity_type", "lost_reason"] as const;

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const data = getFixedGraphData(type as typeof VALID_TYPES[number], id);
  if (!data) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

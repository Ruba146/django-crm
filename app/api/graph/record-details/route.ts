import { NextResponse } from "next/server";
import { getRecordDetails } from "@/services/graph.service";
import type { EntityType } from "@/types/graph";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  const detail = getRecordDetails(type as EntityType, id);
  if (!detail) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({ detail });
}

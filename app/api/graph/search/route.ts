import { NextResponse } from "next/server";
import { searchNodes } from "@/services/graph.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const q = url.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = searchNodes(q);
  return NextResponse.json({ results });
}

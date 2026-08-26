import { NextResponse } from "next/server";
import { getNeighbors, getSubgraph, resolveNode } from "@/services/graph.service";

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

  const node = resolveNode(type as typeof VALID_TYPES[number], id);
  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const depth = Math.min(Math.max(Number(url.searchParams.get("depth")) || 1, 1), 3);
  const includeSubgraph = url.searchParams.get("subgraph") === "true";

  let subgraph = null;
  if (includeSubgraph) {
    subgraph = getSubgraph(type as typeof VALID_TYPES[number], id, depth);
  }

  const neighbors = getNeighbors(type as typeof VALID_TYPES[number], id);

  return NextResponse.json({
    node,
    neighbors: neighbors.edges.slice(0, 50),
    neighborNodes: neighbors.nodes,
    subgraph,
  });
}

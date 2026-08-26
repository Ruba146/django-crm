import { NextResponse } from "next/server";
import { getAllLeadsForGraph } from "@/services/graph.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leads = getAllLeadsForGraph();
    return NextResponse.json(leads);
  } catch {
    return NextResponse.json([]);
  }
}

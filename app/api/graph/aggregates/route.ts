import { NextResponse } from "next/server";
import { getLeadAggregates } from "@/services/graph.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const aggregates = getLeadAggregates();
  return NextResponse.json(aggregates);
}

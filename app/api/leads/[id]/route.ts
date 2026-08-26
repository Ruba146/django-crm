import { NextResponse } from "next/server";
import {
  getLeadActivities,
  getLeadDeals,
  getLeadDetail,
  getLeadTasks,
} from "@/services/lead.service";
import { analyzeLead } from "@/services/ai-analysis.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const detail = getLeadDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const [activities, deals, tasks, analysis] = [
    getLeadActivities(id, 50),
    getLeadDeals(id),
    getLeadTasks(id, 50),
    analyzeLead(id),
  ];

  return NextResponse.json({ detail, activities, deals, tasks, analysis });
}

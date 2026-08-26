import { NextResponse } from "next/server";
import {
  getDealActivities,
  getDealDetail,
  getDealTasks,
} from "@/services/deal.service";
import { analyzeDeal } from "@/services/ai-analysis.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const detail = getDealDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const [activities, tasks, analysis] = [
    getDealActivities(id, 50),
    getDealTasks(id, 50),
    analyzeDeal(id),
  ];

  return NextResponse.json({ detail, activities, tasks, analysis });
}

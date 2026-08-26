import { NextResponse } from "next/server";
import {
  getTaskDetail,
  getTaskRelatedRecord,
} from "@/services/task.service";
import { analyzeTask } from "@/services/ai-analysis.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const detail = getTaskDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const relatedRecord = getTaskRelatedRecord(detail.entity_type, detail.entity_id);
  const analysis = analyzeTask(id);

  return NextResponse.json({ detail, relatedRecord, analysis });
}

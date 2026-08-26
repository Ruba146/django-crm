import { NextResponse } from "next/server";
import {
  getCustomerActivities,
  getCustomerDeals,
  getCustomerDetail,
  getCustomerStatistics,
  getCustomerTasks,
} from "@/services/customer.service";
import { analyzeCustomer } from "@/services/ai-analysis.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const detail = getCustomerDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [statistics, deals, activities, tasks, analysis] = [
    getCustomerStatistics(id),
    getCustomerDeals(id),
    getCustomerActivities(id, 10),
    getCustomerTasks(id, 10),
    analyzeCustomer(id),
  ];

  return NextResponse.json({ detail, statistics, deals, activities, tasks, analysis });
}

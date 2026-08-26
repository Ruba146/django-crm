import { NextResponse } from "next/server";
import { getDealsPage } from "@/services/deal.service";
import { getLeadsPage } from "@/services/lead.service";
import { getCustomersPage } from "@/services/customer.service";
import { getTasksPage } from "@/services/task.service";

export const dynamic = "force-dynamic";

type RecordType = "deals" | "leads" | "customers" | "tasks";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") || "").toLowerCase();

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10) || 25));
    const search = url.searchParams.get("search") || undefined;

    const validTypes: RecordType[] = ["deals", "leads", "customers", "tasks"];
    if (!validTypes.includes(type as RecordType)) {
      return badRequest(`type must be one of: ${validTypes.join(", ")}`);
    }

    const base = { page, pageSize, search };

    if (type === "deals") {
      const data = getDealsPage({
        ...base,
        ownerId: url.searchParams.get("ownerId") || undefined,
        stageId: url.searchParams.get("stageId") || undefined,
        statusId: url.searchParams.get("statusId") || undefined,
        createdFrom: url.searchParams.get("createdFrom") || undefined,
        createdTo: url.searchParams.get("createdTo") || undefined,
      });
      return NextResponse.json(data);
    }

    if (type === "leads") {
      const data = getLeadsPage({
        ...base,
        ownerId: url.searchParams.get("ownerId") || undefined,
        sourceId: url.searchParams.get("sourceId") || undefined,
        stageId: url.searchParams.get("stageId") || undefined,
        createdFrom: url.searchParams.get("createdFrom") || undefined,
        createdTo: url.searchParams.get("createdTo") || undefined,
      });
      return NextResponse.json(data);
    }

    if (type === "customers") {
      const data = getCustomersPage({
        ...base,
        industryId: url.searchParams.get("industryId") || undefined,
        sourceId: url.searchParams.get("sourceId") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        statusId: url.searchParams.get("statusId") || undefined,
      });
      return NextResponse.json(data);
    }

    if (type === "tasks") {
      const data = getTasksPage({
        ...base,
        assigneeId: url.searchParams.get("assigneeId") || undefined,
        taskTypeId: url.searchParams.get("taskTypeId") || undefined,
        entityType: url.searchParams.get("entityType") || undefined,
        dueFrom: url.searchParams.get("dueFrom") || undefined,
        dueTo: url.searchParams.get("dueTo") || undefined,
      });
      return NextResponse.json(data);
    }

    return NextResponse.json({ records: [], total: 0, page: 1, pageSize, totalPages: 1 });
  } catch {
    return NextResponse.json({ records: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
  }
}

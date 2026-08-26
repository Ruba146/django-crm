import { NextResponse } from "next/server";
import { getGraphRecordsList } from "@/services/graph.service";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  try {
    const url = new URL(_request.url);
    const category = url.searchParams.get("category") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const search = url.searchParams.get("search") ?? undefined;
    const stageId = url.searchParams.get("stageId") ?? undefined;
    const sourceId = url.searchParams.get("sourceId") ?? undefined;
    const ownerId = url.searchParams.get("ownerId") ?? undefined;

    if (!category || (category !== "leads" && category !== "deals")) {
      return NextResponse.json({ records: [], total: 0, page: 1, pageSize, totalPages: 1 });
    }

    const data = getGraphRecordsList(category, page, pageSize, search, stageId, sourceId, ownerId);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ records: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 });
  }
}

import { NextResponse } from "next/server";
import { getLeadsByCategory } from "@/services/graph.service";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  try {
    const url = new URL(_request.url);
    const categoryId = url.searchParams.get("categoryId") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const all = url.searchParams.get("all") === "true";
    const pageSize = all ? 10000 : Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const search = url.searchParams.get("search") ?? undefined;

    if (!categoryId) {
      return NextResponse.json({ records: [], total: 0, page: 1, pageSize, totalPages: 1 });
    }

    const data = getLeadsByCategory(categoryId, page, pageSize, search);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ records: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 });
  }
}

import { NextResponse } from "next/server";
import { getLeadCategories } from "@/services/graph.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = getLeadCategories();
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json([]);
  }
}

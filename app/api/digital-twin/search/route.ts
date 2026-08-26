import { NextResponse } from "next/server";
import { searchDigitalTwinEntities } from "@/services/digital-twin.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  try {
    const url = new URL(_request.url);
    const q = url.searchParams.get("q") ?? "";

    const results = searchDigitalTwinEntities(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { query: "", results: { customers: [], leads: [], deals: [], employees: [] } },
      { status: 200 }
    );
  }
}

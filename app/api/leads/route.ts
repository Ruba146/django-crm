import { NextResponse } from "next/server";
import { getLeads } from "@/services/lead.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const leads = getLeads();
  return NextResponse.json(leads);
}

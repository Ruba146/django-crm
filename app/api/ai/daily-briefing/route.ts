import { NextResponse } from "next/server";
import { getDailyBriefing, type DailyBriefing } from "@/services/ai-priority.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const briefing: DailyBriefing = getDailyBriefing();
    return NextResponse.json(briefing);
  } catch (error) {
    console.error("Daily briefing API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

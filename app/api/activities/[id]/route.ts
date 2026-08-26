import { NextResponse } from "next/server";
import { getActivityTimeline } from "@/services/activity.service";

/**
 * Activity record timeline API — thin route handler for the split-view panel.
 *
 * The `[id]` param is a composite `entityType:entityId` (e.g. `lead:<id>` or
 * `deal:<id>`). This endpoint loads ONLY that record's timeline on demand —
 * it never preloads every activity. No business logic and no SQL here; it
 * only calls the activity service layer.
 */
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const timeline = getActivityTimeline(id);
  if (!timeline) {
    return NextResponse.json(
      { error: "Activity record not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(timeline);
}


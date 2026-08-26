import { NextResponse } from "next/server";
import { searchConversations, initAiTables } from "@/services/ai-conversation.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    initAiTables();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Number(searchParams.get("limit") || 20);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = searchConversations(query, limit);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to search conversations:", error);
    return NextResponse.json(
      { error: "Failed to search conversations" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { executeAction } from "@/services/ai-action-executor.service";
import { parseActionsFromResponse } from "@/services/ai-action-parser.service";
import type { AIAction, ChatMessage, PageContext } from "@/types/ai-chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: AIAction;
      responseText?: string;
      context: PageContext;
      messages?: ChatMessage[];
    };

    if (body.action) {
      const result = executeAction(body.action);
      return NextResponse.json(result);
    }

    if (body.responseText && body.context) {
      const actions = parseActionsFromResponse(body.responseText, body.context);
      return NextResponse.json({ actions });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("AI Actions API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  getConversation,
  createConversation,
  addMessage,
  initAiTables,
} from "@/services/ai-conversation.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    initAiTables();
    const body = (await request.json()) as {
      conversationId?: string;
      title?: string;
      messages?: Array<{ role: string; content: string }>;
    };

    if (!body.conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    let conversationId = body.conversationId;
    let conversation = getConversation(conversationId);

    if (!conversation && body.title) {
      const created = createConversation(body.title);
      conversationId = created.id;
      conversation = { ...created, messages: [] };
    }

    if (conversation && body.title) {
      const { updateConversationTitle } = await import("@/services/ai-conversation.service");
      updateConversationTitle(conversationId, body.title);
    }

    if (conversation && body.messages && body.messages.length > 0) {
      const existingCount = conversation.messages.length;
      for (let i = existingCount; i < body.messages.length; i++) {
        const msg = body.messages[i];
        addMessage(conversationId, msg.role as "user" | "assistant", msg.content, msg.role === "assistant");
      }
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    console.error("Failed to sync conversation:", error);
    return NextResponse.json(
      { error: "Failed to sync conversation" },
      { status: 500 }
    );
  }
}

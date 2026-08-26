import { NextResponse } from "next/server";
import {
  listConversations,
  createConversation,
  initAiTables,
} from "@/services/ai-conversation.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    initAiTables();
    const conversations = listConversations(50);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to list conversations:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    initAiTables();
    const body = (await request.json()) as {
      title?: string;
      entity_type?: string;
      entity_id?: string;
    };
    const conversation = createConversation(
      body.title,
      body.entity_type || null,
      body.entity_id || null
    );
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

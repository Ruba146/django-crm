import { NextResponse } from "next/server";
import { getCRMContext, searchCRMRecords, validateRecordContext } from "@/services/ai-context.service";
import { buildSystemPrompt } from "@/lib/ai-prompts";
import { getOpenRouterClient, OpenRouterError } from "@/services/openrouter.service";
import type { ChatMessage, PageContext } from "@/types/ai-chat";

export const dynamic = "force-dynamic";

function toProviderMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages: ChatMessage[];
      context: PageContext;
      options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        timeout?: number;
      };
    };

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    if (!body.context) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    const context = body.context;
    const lastUserMessage = body.messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    const userMessageText = lastUserMessage?.content ?? "";

    const recordValidation = validateRecordContext(context);
    if (!recordValidation.valid) {
      return NextResponse.json({ error: recordValidation.error }, { status: 404 });
    }

    const crmContext = getCRMContext(context, userMessageText);

    if (userMessageText) {
      const entityResults = searchCRMRecords(userMessageText);
      if (
        entityResults.customers.length > 0 ||
        entityResults.leads.length > 0 ||
        entityResults.deals.length > 0 ||
        entityResults.owners.length > 0 ||
        entityResults.tasks.length > 0 ||
        entityResults.activities.length > 0
      ) {
        crmContext.entitySearchResults = entityResults;
      }
    }

    const systemPrompt = buildSystemPrompt(crmContext);

    let client = getOpenRouterClient();

    if (!client) {
      const { LocalProvider } = await import("@/services/ai-copilot.server");
      const provider = new LocalProvider();
      const stream = provider.sendMessage(body.messages, context);

      const readableStream = new ReadableStream({
        async pull(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of stream) {
              controller.enqueue(encoder.encode(chunk));
            }
          } catch {
            // Stream interrupted; do not expose raw error to client
          } finally {
            controller.close();
          }
        },
        cancel() {
          // Client aborted the stream
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (body.options?.model) {
      client = new (await import("@/services/openrouter.service")).OpenRouterClient({
        apiKey: process.env.OPENROUTER_API_KEY!,
        model: body.options.model,
        temperature: body.options.temperature ?? 0.7,
        maxTokens: body.options.maxTokens ?? 2048,
        timeout: body.options.timeout ?? 60000,
        maxRetries: 2,
      });
    }

    const providerMessages = toProviderMessages(body.messages);
    const stream = client.streamChat(providerMessages, systemPrompt);

    const readableStream = new ReadableStream({
      async pull(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch {
          // Stream interrupted; do not expose raw error to client
        } finally {
          controller.close();
        }
      },
      cancel() {
        // Client aborted the stream
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("AI Copilot API error:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    if (error instanceof OpenRouterError) {
      const userMessage =
        error.statusCode === 401
          ? "AI service authentication failed. Please check your configuration."
          : error.statusCode === 429
            ? "AI service is busy. Please try again in a moment."
            : error.statusCode && error.statusCode >= 500
              ? "AI service is temporarily unavailable. Please try again later."
              : "AI service error. Please try again.";
      return NextResponse.json(
        { error: userMessage, statusCode: error.statusCode },
        { status: error.statusCode ?? 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}

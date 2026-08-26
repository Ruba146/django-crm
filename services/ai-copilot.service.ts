import type {
  AIProviderOptions,
  ChatMessage,
  PageContext,
} from "@/types/ai-chat";

export async function* streamAIResponse(
  messages: ChatMessage[],
  context: PageContext,
  _options?: AIProviderOptions & { signal?: AbortSignal }
): AsyncIterable<string> {
  const response = await fetch("/api/ai/copilot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      context,
      options: _options ? {
        model: _options.model,
        temperature: _options.temperature,
        maxTokens: _options.maxTokens,
      } : undefined,
    }),
    signal: _options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorMessage = "AI request failed";
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorMessage;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    if (_options?.signal?.aborted) {
      return;
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    if (_options?.signal?.aborted) {
      reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      yield decoder.decode(value, { stream: true });
    }
  }
}

export async function getAIResponse(
  messages: ChatMessage[],
  context: PageContext,
  _options?: AIProviderOptions
): Promise<{ content: string }> {
  const chunks: string[] = [];
  for await (const chunk of streamAIResponse(messages, context, _options)) {
    chunks.push(chunk);
  }
  const content = chunks.join("");
  return { content: content || "" };
}

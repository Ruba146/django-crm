export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable?: boolean
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export class OpenRouterClient {
  private readonly config: Required<OpenRouterConfig>;

  constructor(config: OpenRouterConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 2,
    };
  }

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string
  ): AsyncIterable<string> {
    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        yield* this.executeRequest(allMessages);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = this.isRetryable(lastError);
        if (!retryable || attempt >= this.config.maxRetries) {
          throw new OpenRouterError(
            lastError.message,
            lastError instanceof OpenRouterError ? lastError.statusCode : undefined,
            retryable
          );
        }
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new OpenRouterError(
      lastError?.message ?? "Unknown error",
      undefined,
      false
    );
  }

  private async *executeRequest(
    messages: Array<{ role: string; content: string }>
  ): AsyncIterable<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "Mawrid CRM AI Copilot",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = "AI service error";
        try {
          const parsed = JSON.parse(text);
          const apiMessage = parsed.error?.message;
          if (apiMessage && typeof apiMessage === "string") {
            errorMessage = apiMessage.length > 200 ? "AI service error" : apiMessage;
          }
        } catch {
          // ignore parse errors, use default message
        }
        throw new OpenRouterError(errorMessage, response.status, response.status >= 500);
      }

      if (!response.body) {
        throw new OpenRouterError("Empty response body from OpenRouter", undefined, false);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof OpenRouterError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenRouterError("Request timed out", undefined, true);
      }
      throw new OpenRouterError(
        error instanceof Error ? error.message : "Unknown error",
        undefined,
        true
      );
    }
  }

  private isRetryable(error: Error): boolean {
    if (error instanceof OpenRouterError) {
      if (error.statusCode && error.statusCode >= 500) return true;
      return error.retryable ?? false;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("enotfound") ||
      message.includes("network")
    );
  }
}

export function getOpenRouterClient(): OpenRouterClient | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

  return new OpenRouterClient({
    apiKey,
    model,
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 60000,
    maxRetries: 2,
  });
}

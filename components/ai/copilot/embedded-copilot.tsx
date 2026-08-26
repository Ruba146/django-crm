"use client";

import { useMemo, useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTranslations } from "@/hooks/use-translations";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import { streamAIResponse } from "@/services/ai-copilot.service";
import { stripActionMarkers } from "@/services/ai-action-parser.service";
import { ChatMessage } from "@/components/ai/copilot/chat-message";
import { ChatInput } from "@/components/ai/copilot/chat-input";
import { SuggestedPrompts } from "@/components/ai/copilot/suggested-prompts";
import { TypingIndicator } from "@/components/ai/copilot/typing-indicator";

export function EmbeddedCopilot() {
  const { t } = useTranslations();
  const {
    conversations,
    activeConversationId,
    isTyping,
    error,
    sendMessage,
    stopTyping,
    setError,
    loadConversationsFromServer,
    syncConversationToServer,
  } = useAICopilotStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversationsFromServer();
  }, [loadConversationsFromServer]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );
  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (content: string) => {
    try {
      setError(null);
      await sendMessage(content);

      const state = useAICopilotStore.getState();
      const currentConversation = state.conversations.find(
        (c) => c.id === state.activeConversationId
      );
      if (!currentConversation) return;

      const allMessages = currentConversation.messages;
      const stream = streamAIResponse(allMessages, state.pageContext);

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
        const displayContent = stripActionMarkers(fullResponse);
        useAICopilotStore.setState((s) => {
          const conversations = s.conversations.map((c) => {
            if (c.id !== s.activeConversationId) return c;
            const msgs = c.messages.map((m) =>
              m.role === "assistant" && m.isStreaming
                ? { ...m, content: displayContent }
                : m
            );
            return { ...c, messages: msgs };
          });
          return { conversations };
        });
      }

      stopTyping();
      const finalId = useAICopilotStore.getState().activeConversationId;
      if (finalId) {
        syncConversationToServer(finalId);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An error occurred";
      setError(message);
      stopTyping();
    }
  };

  const showSuggestions = messages.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">
            <MessageSquare className="size-4" />
          </div>
          <CardTitle>{t("copilot.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-[400px] flex-col rounded-xl border border-border bg-card">
          <div className="flex-1 overflow-y-auto">
            {showSuggestions && (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-600/10 text-primary-600">
                  <MessageSquare className="size-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  {t("copilot.welcomeTitle")}
                </h4>
                <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                  {t("copilot.welcomeHint")}
                </p>
                <div className="mt-4 w-full">
                  <SuggestedPrompts onSelect={handleSend} />
                </div>
              </div>
            )}

            <div className="py-3">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {error && (
            <div className="border-t border-border bg-danger/5 px-4 py-2">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          {showSuggestions && (
            <div className="border-t border-border bg-card px-4 py-3">
              <SuggestedPrompts onSelect={handleSend} />
            </div>
          )}

          <ChatInput onSend={handleSend} disabled={isTyping} />
        </div>
      </CardContent>
    </Card>
  );
}

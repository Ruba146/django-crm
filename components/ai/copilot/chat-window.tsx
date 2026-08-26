"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X, History, Volume2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslations } from "@/hooks/use-translations";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import { streamAIResponse } from "@/services/ai-copilot.service";
import { parseActionsFromResponse, stripActionMarkers, validateAction } from "@/services/ai-action-parser.service";
import type { AIAction, Conversation } from "@/types/ai-chat";
import { useVoiceOutput } from "@/hooks/use-voice-output";
import { VoiceSettings } from "./voice-settings";
import { TypingIndicator } from "./typing-indicator";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { SuggestedPrompts } from "./suggested-prompts";
import { ConversationHistory } from "./conversation-history";
import { ActionConfirmation } from "./action-confirmation";
import { ActionHistoryPanel } from "./action-history-panel";

export function FloatingAIButton({ className }: { className?: string }) {
  const { t } = useTranslations();
  const { isOpen, open } = useAICopilotStore();

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isOpen && "pointer-events-none scale-0 opacity-0",
        className
      )}
      aria-label={t("copilot.openAssistant")}
    >
      <MessageSquare className="size-5" />
    </button>
  );
}

export function ChatWindow({ className }: { className?: string }) {
  const { t, locale } = useTranslations();
  const {
    conversations,
    activeConversationId,
    isOpen,
    isTyping,
    pageContext,
    error,
    pendingAction,
    actionHistory,
    voiceSettings,
    setVoiceSettings,
    close,
    sendMessage,
    stopTyping,
    clearConversation,
    startNewConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    setError,
    setPendingAction,
    addActionHistory,
    updateActionHistory,
    loadConversationsFromServer,
  } = useAICopilotStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showActionHistory, setShowActionHistory] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const lastSpokenRef = useRef("");
  const shouldScrollRef = useRef(true);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadConversationsFromServer();
  }, [loadConversationsFromServer]);

  const {
    status: voiceStatus,
    voices,
    speak,
    pause,
    resume,
    stop,
    updateSettings,
  } = useVoiceOutput({
    settings: voiceSettings,
    onStatusChange: () => {},
  });

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );
  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation]
  );

  const displayedConversations = searchQuery && searchResults.length > 0
    ? searchResults
    : conversations;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      isSubmittingRef.current = false;
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.length >= 2) {
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/ai/conversations/search?q=${encodeURIComponent(value)}&limit=20`);
          const data = await res.json();
          setSearchResults(data.results || []);
        } catch {
          setSearchResults([]);
        }
      }, 300);
    } else {
      setSearchResults([]);
    }
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsExecuting(true);

    const historyEntry = {
      id: crypto.randomUUID(),
      action: pendingAction,
      status: "executing" as const,
      timestamp: Date.now(),
    };

    addActionHistory(historyEntry);

    try {
      const response = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction }),
      });

      const result = await response.json();

      if (result.success) {
        updateActionHistory(historyEntry.id, {
          status: "executed" as const,
          result,
        });
        window.dispatchEvent(new CustomEvent("ai-action-executed", { detail: { action: pendingAction, result } }));
      } else {
        updateActionHistory(historyEntry.id, {
          status: "failed" as const,
          error: result.message || "Action failed",
        });
      }
    } catch {
      updateActionHistory(historyEntry.id, {
        status: "failed" as const,
        error: "Network error",
      });
    } finally {
      setPendingAction(null);
      setIsExecuting(false);
      isSubmittingRef.current = false;
    }
  }, [pendingAction, addActionHistory, updateActionHistory, setPendingAction]);

  const handleCancelAction = useCallback(() => {
    if (pendingAction) {
      addActionHistory({
        id: crypto.randomUUID(),
        action: pendingAction,
        status: "cancelled",
        timestamp: Date.now(),
      });
    }
    setPendingAction(null);
    isSubmittingRef.current = false;
    stopTyping();
  }, [pendingAction, addActionHistory, setPendingAction, stopTyping]);

  const handleSend = async (content: string) => {
    if (isSubmittingRef.current || !content.trim()) return;
    isSubmittingRef.current = true;

    try {
      setError(null);
      setPendingAction(null);
      await sendMessage(content);

      const state = useAICopilotStore.getState();
      const currentConversation = state.conversations.find(
        (c) => c.id === state.activeConversationId
      );
      if (!currentConversation) {
        isSubmittingRef.current = false;
        return;
      }

      const allMessages = currentConversation.messages;
      abortRef.current = new AbortController();
      const stream = streamAIResponse(allMessages, state.pageContext, {
        signal: abortRef.current.signal,
      });

      let fullResponse = "";
      let streamError: Error | null = null;
      try {
        for await (const chunk of stream) {
          if (abortRef.current?.signal.aborted) break;
          fullResponse += chunk;
          const displayContent = stripActionMarkers(fullResponse);
          useAICopilotStore.setState((s) => {
            const nextConversations = s.conversations.map((c) => {
              if (c.id !== s.activeConversationId) return c;
              const msgs = c.messages.map((m) =>
                m.role === "assistant" && m.isStreaming
                  ? { ...m, content: displayContent }
                  : m
              );
              return { ...c, messages: msgs };
            });
            return { conversations: nextConversations };
          });
        }
      } catch (err) {
        streamError = err instanceof Error ? err : new Error(String(err));
      }

      const cleanResponse = stripActionMarkers(fullResponse);
      const actions = parseActionsFromResponse(fullResponse, state.pageContext);

      if (streamError) {
        const friendlyMessage = "Sorry, I couldn't complete that request. Please try again.";
        useAICopilotStore.setState((s) => {
          const nextConversations = s.conversations.map((c) => {
            if (c.id !== s.activeConversationId) return c;
            const msgs = c.messages.map((m) =>
              m.role === "assistant" && m.isStreaming
                ? { ...m, content: friendlyMessage, isStreaming: false }
                : m
            );
            return { ...c, messages: msgs };
          });
          return { conversations: nextConversations, isTyping: false, error: friendlyMessage };
        });
      } else if (actions.length > 0) {
        const invalidAction = actions.find((a) => validateAction(a));
        if (invalidAction) {
          const clarification = cleanResponse + "\n\n" + getClarificationMessage(invalidAction);
          useAICopilotStore.setState((s) => {
            const nextConversations = s.conversations.map((c) => {
              if (c.id !== s.activeConversationId) return c;
              const msgs = c.messages.map((m) =>
                m.role === "assistant" && m.isStreaming
                  ? { ...m, content: clarification, isStreaming: false }
                  : m
              );
              return { ...c, messages: msgs };
            });
            return { conversations: nextConversations, isTyping: false };
          });
        } else {
          useAICopilotStore.setState((s) => {
            const nextConversations = s.conversations.map((c) => {
              if (c.id !== s.activeConversationId) return c;
              const msgs = c.messages.map((m) =>
                m.role === "assistant" && m.isStreaming
                  ? { ...m, content: cleanResponse, isStreaming: false }
                  : m
              );
              return { ...c, messages: msgs };
            });
            return { conversations: nextConversations };
          });
          setPendingAction(actions[0]);
        }
      } else {
        useAICopilotStore.setState((s) => {
          const nextConversations = s.conversations.map((c) => {
            if (c.id !== s.activeConversationId) return c;
            const msgs = c.messages.map((m) =>
              m.role === "assistant" && m.isStreaming
                ? { ...m, content: cleanResponse, isStreaming: false }
                : m
            );
            return { ...c, messages: msgs };
          });
          return { conversations: nextConversations };
        });
      }

      stopTyping();

      if (voiceSettings.enabled && voiceSettings.autoRead && cleanResponse && cleanResponse !== lastSpokenRef.current) {
        lastSpokenRef.current = cleanResponse;
        speak(cleanResponse);
      }

      const finalConversationId = useAICopilotStore.getState().activeConversationId;
      if (finalConversationId) {
        useAICopilotStore.getState().syncConversationToServer(finalConversationId);
      }
    } catch {
      const friendlyMessage = "Sorry, I couldn't complete that request. Please try again.";
      setError(friendlyMessage);
      stopTyping();
    } finally {
      isSubmittingRef.current = false;
      abortRef.current = null;
    }
  };

  function getClarificationMessage(action: AIAction): string {
    const key = `copilot.clarify.${action.type}`;
    const fallback = t("copilot.clarify.default", "Sure, I need a bit more information to proceed.");
    return t(key, fallback);
  }

  const handleSelectPrompt = (text: string) => {
    handleSend(text);
  };

  if (!isOpen) return null;

  const showSuggestions =
    messages.length === 0 || (messages.length === 1 && messages[0].role === "user");

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 40, y: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-[min(600px,calc(100vh-3rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
        className
      )}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("copilot.title")}
            </h3>
            <p className="text-[10px] text-muted-foreground capitalize">
              {pageContext.page}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={cn(
                "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                (voiceSettings.enabled || showVoiceSettings) && "bg-accent text-foreground"
              )}
              aria-label="Voice settings"
              title="Voice settings"
            >
              <Volume2 className="size-4" />
            </button>
            <AnimatePresence>
              {showVoiceSettings && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl z-50"
                >
                  <VoiceSettings
                    settings={voiceSettings}
                    onUpdate={(partial) => {
                      updateSettings(partial);
                      setVoiceSettings(partial);
                    }}
                    voices={voices}
                    status={voiceStatus}
                    onSpeak={speak}
                    onPause={pause}
                    onResume={resume}
                    onStop={stop}
                    locale={locale}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setShowActionHistory(!showActionHistory)}
            className={cn(
              "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              showActionHistory && "bg-accent text-foreground"
            )}
            aria-label="Action history"
            title="Action history"
          >
            <History className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              showHistory && "bg-accent text-foreground"
            )}
            aria-label={t("copilot.history")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
              <path d="M3 5v7h7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={clearConversation}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("copilot.clear")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M3 6h18" />
              <path d="M7 12h10" />
              <path d="M10 18h4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showActionHistory ? (
          <motion.div
            key="action-history"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <ActionHistoryPanel entries={actionHistory} />
          </motion.div>
        ) : showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <ConversationHistory
              conversations={displayedConversations}
              activeId={activeConversationId}
              onSelect={(id) => {
                switchConversation(id);
                setShowHistory(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              onDelete={deleteConversation}
              onRename={renameConversation}
              onNew={startNewConversation}
              onSearchResults={handleSearchChange}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
              {messages.length === 0 && (
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
                    <SuggestedPrompts onSelect={handleSelectPrompt} />
                  </div>
                </div>
              )}

              <div className="py-3">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isTyping && (
                  <TypingIndicator className="px-4" />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {error && (
              <div className="border-t border-border bg-danger/5 px-4 py-2">
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            {showSuggestions && messages.length === 0 && (
              <div className="border-t border-border bg-card px-4 py-3">
                <SuggestedPrompts onSelect={handleSelectPrompt} />
              </div>
            )}

            <ChatInput
              onSend={handleSend}
              disabled={isTyping}
              locale={locale}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ActionConfirmation
        action={pendingAction}
        open={!!pendingAction}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        isExecuting={isExecuting}
      />
    </motion.div>
  );
}

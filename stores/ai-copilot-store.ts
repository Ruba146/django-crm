"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIAction,
  ActionHistoryEntry,
  ChatMessage,
  Conversation,
  CopilotState,
  PageContext,
  PageName,
  SuggestedPrompt,
  VoiceSettings,
} from "@/types/ai-chat";

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

function generateId(): string {
  return crypto.randomUUID();
}

function createEmptyConversation(context: PageContext): Conversation {
  return {
    id: generateId(),
    title: "New Conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    context,
  };
}

interface AICopilotState extends CopilotState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setPageContext: (context: PageContext) => void;
  sendMessage: (content: string) => Promise<void>;
  stopTyping: () => void;
  clearConversation: () => void;
  startNewConversation: () => void;
  switchConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  getSuggestedPrompts: () => SuggestedPrompt[];
  setPendingAction: (action: AIAction | null) => void;
  addActionHistory: (entry: ActionHistoryEntry) => void;
  updateActionHistory: (id: string, updates: Partial<ActionHistoryEntry>) => void;
  clearActionHistory: () => void;
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  setConversationMemory: (memory: Partial<Record<string, string | undefined>>) => void;
  loadConversationsFromServer: () => Promise<void>;
  syncConversationToServer: (conversationId: string) => Promise<void>;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const useAICopilotStore = create<AICopilotState>()(
  persist(
    (set, get) => ({
      conversations: [createEmptyConversation({ page: "dashboard", route: "/" })],
      activeConversationId: null,
      isOpen: false,
      isTyping: false,
      pageContext: { page: "dashboard", route: "/" },
      error: null,
      pendingAction: null,
      actionHistory: [],
      voiceSettings: {
        enabled: false,
        voice: "",
        speed: 1,
        autoRead: false,
      },
      conversationMemory: {},

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),

      setPageContext: (context) =>
        set((state) => {
          const conversationMemory = { ...state.conversationMemory };
          if (context.recordType === "customer" && context.recordId) {
            conversationMemory.currentCustomerId = context.recordId;
          } else if (context.recordType === "lead" && context.recordId) {
            conversationMemory.currentLeadId = context.recordId;
          } else if (context.recordType === "deal" && context.recordId) {
            conversationMemory.currentDealId = context.recordId;
          }

          const active = state.conversations.find(
            (c) => c.id === state.activeConversationId
          );
          const mergedContext = {
            ...context,
            metadata: {
              ...context.metadata,
              conversationMemory,
            },
          };
          if (active && !active.context) {
            return {
              pageContext: mergedContext,
              conversations: state.conversations.map((c) =>
                c.id === active.id ? { ...c, context: mergedContext } : c
              ),
              conversationMemory,
            };
          }
          return { pageContext: mergedContext, conversationMemory };
        }),

      loadConversationsFromServer: async () => {
        try {
          const data = await apiRequest("/api/ai/conversations");
          const serverConversations = (data.conversations || []) as Array<{
            id: string;
            title: string;
            entity_type: string | null;
            entity_id: string | null;
            created_at: string;
            updated_at: string;
          }>;
          if (serverConversations.length > 0) {
            const hydrated = serverConversations.map((c) => ({
              id: c.id,
              title: c.title,
              messages: [],
              createdAt: Date.parse(c.created_at),
              updatedAt: Date.parse(c.updated_at),
              context: c.entity_type && c.entity_id
                ? { page: c.entity_type as PageName, recordId: c.entity_id, recordType: c.entity_type as "customer" | "lead" | "deal" | "activity" | "task", route: `/${c.entity_type}s` }
                : undefined,
            }));
            set({
              conversations: hydrated,
              activeConversationId: hydrated[0]?.id ?? null,
            });
          }
        } catch {
          // Server unavailable; keep local state
        }
      },

      syncConversationToServer: async (conversationId: string) => {
        const state = get();
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (!conversation) return;
        try {
          await fetch("/api/ai/conversations/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId,
              title: conversation.title,
              messages: conversation.messages.map((m) => ({ role: m.role, content: m.content })),
            }),
          });
        } catch {
          // Sync failure is non-critical
        }
      },

      sendMessage: async (content) => {
        const { pageContext, conversationMemory } = get();
        const trimmed = content.trim();
        if (!trimmed) return;

        const contextWithMemory = {
          ...pageContext,
          metadata: {
            ...pageContext.metadata,
            conversationMemory,
          },
        };

        set((state) => {
          const conversations = [...state.conversations];
          let active = conversations.find(
            (c) => c.id === state.activeConversationId
          );

          if (!active) {
            const newConversation = createEmptyConversation(contextWithMemory);
            conversations.unshift(newConversation);
            active = newConversation;
          }

          const userMessage: ChatMessage = {
            id: generateId(),
            role: "user",
            content: trimmed,
            timestamp: Date.now(),
          };

          const assistantMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: "",
            timestamp: Date.now(),
            isStreaming: true,
          };

          const updatedMessages = [
            ...active.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
            userMessage,
            assistantMessage,
          ];

          const updatedConversation = {
            ...active,
            messages: updatedMessages,
            updatedAt: Date.now(),
            title:
              active.messages.length === 0
                ? trimmed.slice(0, 40)
                : active.title,
            context: active.context ?? contextWithMemory,
          };

          const index = conversations.findIndex(
            (c) => c.id === active!.id
          );
          if (index >= 0) {
            conversations[index] = updatedConversation;
          } else {
            conversations.unshift(updatedConversation);
          }

          if (conversations.length > MAX_CONVERSATIONS) {
            conversations.length = MAX_CONVERSATIONS;
          }

          return {
            conversations,
            activeConversationId: updatedConversation.id,
            pageContext: contextWithMemory,
            isTyping: true,
            error: null,
          };
        });

        const currentId = get().activeConversationId;
        if (currentId) {
          get().syncConversationToServer(currentId).catch(() => {});
        }
      },

      stopTyping: () =>
        set((state) => ({
          isTyping: false,
          conversations: state.conversations.map((c) =>
            c.id === state.activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.role === "assistant" && m.isStreaming
                      ? { ...m, isStreaming: false }
                      : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      clearConversation: () =>
        set((state) => {
          if (!state.activeConversationId) return state;
          return {
            conversations: state.conversations.map((c) =>
              c.id === state.activeConversationId
                ? { ...c, messages: [], updatedAt: Date.now() }
                : c
            ),
          };
        }),

      startNewConversation: () => {
        const { pageContext } = get();
        const newConversation = createEmptyConversation(pageContext);
        set((state) => ({
          conversations: [newConversation, ...state.conversations].slice(
            0,
            MAX_CONVERSATIONS
          ),
          activeConversationId: newConversation.id,
          error: null,
        }));
        get().syncConversationToServer(newConversation.id).catch(() => {});
      },

      switchConversation: (id) =>
        set({ activeConversationId: id, error: null }),

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
        get().syncConversationToServer(id);
      },

      deleteConversation: (id) => {
        set((state) => {
          const conversations = state.conversations.filter(
            (c) => c.id !== id
          );
          let activeConversationId = state.activeConversationId;
          if (activeConversationId === id) {
            activeConversationId =
              conversations[0]?.id ?? null;
          }
          return { conversations, activeConversationId };
        });
        fetch(`/api/ai/conversations/${id}`, { method: "DELETE" }).catch(() => {});
      },

      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      setPendingAction: (action) => set({ pendingAction: action }),

      addActionHistory: (entry) =>
        set((state) => ({
          actionHistory: [entry, ...state.actionHistory].slice(0, 100),
        })),

      updateActionHistory: (id, updates) =>
        set((state) => ({
          actionHistory: state.actionHistory.map((entry) =>
            entry.id === id ? { ...entry, ...updates } : entry
          ),
        })),

      clearActionHistory: () => set({ actionHistory: [] }),

      setVoiceSettings: (partial) =>
        set((state) => ({
          voiceSettings: { ...state.voiceSettings, ...partial },
        })),

      setConversationMemory: (memory) =>
        set((state) => ({
          conversationMemory: { ...state.conversationMemory, ...memory },
        })),

      getSuggestedPrompts: () => {
        const { pageContext } = get();
        const page = pageContext.page;

        const pagePrompts: Record<PageName, SuggestedPrompt[]> = {
          dashboard: [
            { id: "d1", text: "What should I do today?", context: "dashboard" },
            { id: "d2", text: "Summarize my pipeline.", context: "dashboard" },
            { id: "d3", text: "Which deals need attention?", context: "dashboard" },
          ],
          customers: [
            { id: "c1", text: "Summarize this customer.", context: "customers" },
            { id: "c2", text: "Show customer activity.", context: "customers" },
          ],
          leads: [
            { id: "l1", text: "Prioritize these leads.", context: "leads" },
            { id: "l2", text: "Suggest next steps.", context: "leads" },
          ],
          deals: [
            { id: "de1", text: "Analyze this deal.", context: "deals" },
            { id: "de2", text: "Suggest a closing strategy.", context: "deals" },
          ],
          activities: [
            { id: "a1", text: "What happened recently?", context: "activities" },
            { id: "a2", text: "Summarize recent activities.", context: "activities" },
          ],
          tasks: [
            { id: "t1", text: "What is my highest priority task?", context: "tasks" },
            { id: "t2", text: "Help me prioritize.", context: "tasks" },
          ],
          reports: [
            { id: "r1", text: "Explain these numbers.", context: "reports" },
            { id: "r2", text: "What trends do you see?", context: "reports" },
          ],
          settings: [
            { id: "s1", text: "How do I configure the CRM?", context: "settings" },
          ],
          ai: [
            { id: "ai1", text: "What insights can you give me?", context: "ai" },
            { id: "ai2", text: "Suggest areas for improvement.", context: "ai" },
          ],
        };

        return pagePrompts[page] ?? [];
      },
    }),
    {
      name: "ai-copilot-state",
      partialize: (state) => ({
        conversations: state.conversations.slice(0, 10),
        activeConversationId: state.activeConversationId,
        pageContext: state.pageContext,
        voiceSettings: state.voiceSettings,
        actionHistory: state.actionHistory.slice(0, 50),
      }),
    }
  )
);

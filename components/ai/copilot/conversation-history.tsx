"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/utils/cn";
import { useTranslations } from "@/hooks/use-translations";
import type { Conversation } from "@/types/ai-chat";

export function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  onSearchResults,
  className,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNew: () => void;
  onSearchResults?: (query: string) => void;
  className?: string;
}) {
  const { t } = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt
      ),
    [conversations]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      onSearchResults?.(value);
    },
    [onSearchResults]
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {t("copilot.newConversation")}
        </button>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("copilot.searchConversations", "Search conversations...")}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sorted.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {searchQuery ? t("copilot.noSearchResults", "No results") : t("copilot.noConversations")}
          </p>
        ) : (
          <div className="space-y-1">
            {sorted.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onSelect={() => onSelect(conv.id)}
                onDelete={() => onDelete(conv.id)}
                onRename={(title) => onRename(conv.id, title)}
                messageCount={conv.messages.length}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  messageCount,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  messageCount: number;
}) {
  const { t } = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    } else {
      setEditTitle(conversation.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditTitle(conversation.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          : "text-foreground hover:bg-accent"
      )}
    >
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 rounded border border-input bg-transparent px-1.5 py-0.5 text-xs outline-none focus:border-primary-500"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 truncate text-left text-xs"
        >
          <span className="block truncate">{conversation.title}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {messageCount} {t("copilot.messages")}
          </span>
        </button>
      )}
      <div className="flex items-center gap-0.5">
        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setEditTitle(conversation.title);
              setIsEditing(true);
            }}
            className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:block"
            aria-label={t("copilot.renameConversation")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger group-hover:block"
          aria-label={t("copilot.deleteConversation")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

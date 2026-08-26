"use client";

import { useMemo } from "react";
import { cn } from "@/utils/cn";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import { useTranslations } from "@/hooks/use-translations";
import type { SuggestedPrompt } from "@/types/ai-chat";

export function SuggestedPrompts({
  onSelect,
  className,
}: {
  onSelect: (text: string) => void;
  className?: string;
}) {
  const { t } = useTranslations();
  const pageContext = useAICopilotStore((s) => s.pageContext);
  const page = pageContext.page;

  const prompts: SuggestedPrompt[] = useMemo(() => {
    const pagePrompts: Record<string, SuggestedPrompt[]> = {
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

    return pagePrompts[page] ?? pagePrompts.dashboard;
  }, [page]);

  if (prompts.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground px-1">
        {t("copilot.suggestedPrompts", "Suggested prompts")}
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onSelect(prompt.text)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "@/hooks/use-translations";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import { MessageSquare } from "lucide-react";
import { cn } from "@/utils/cn";

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

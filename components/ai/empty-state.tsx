"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

export function EmptyStateAI() {
  return (
    <EmptyState
      title="No AI insights available"
      description="Add more leads, deals, and activities to generate intelligent insights and recommendations."
      icon={<Sparkles className="size-6" />}
    />
  );
}

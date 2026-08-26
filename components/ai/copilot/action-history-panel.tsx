"use client";

import { useMemo } from "react";
import { History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import type { ActionHistoryEntry } from "@/types/ai-chat";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", label: "Pending" },
  confirmed: { icon: Clock, color: "text-info", label: "Confirmed" },
  executing: { icon: Clock, color: "text-info", label: "Executing" },
  executed: { icon: CheckCircle2, color: "text-success", label: "Executed" },
  failed: { icon: XCircle, color: "text-danger", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", label: "Cancelled" },
};

const ACTION_LABELS: Record<string, string> = {
  create_task: "Create Task",
  create_activity: "Create Activity",
  create_lead: "Create Lead",
  create_deal: "Create Deal",
  create_note: "Create Note",
  update_deal_stage: "Update Deal Stage",
  assign_owner: "Assign Owner",
  schedule_followup: "Schedule Follow-up",
};

export function ActionHistoryPanel({
  entries,
  className,
}: {
  entries: ActionHistoryEntry[];
  className?: string;
}) {

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp),
    [entries]
  );

  if (entries.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <History className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No actions executed yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Executed AI actions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {sorted.map((entry) => {
        const config = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
        const Icon = config.icon;
        const label = ACTION_LABELS[entry.action.type] || entry.action.type;

        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className={cn("mt-0.5 shrink-0", config.color)}>
              <Icon className="size-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <span className={cn("text-[10px] font-medium uppercase", config.color)}>
                  {config.label}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {entry.action.label}
              </p>

              {entry.result && (entry.result.message as string) && (
                <p className="text-xs text-success mt-1">{entry.result.message as string}</p>
              )}

              {entry.error && (
                <p className="text-xs text-danger mt-1">{entry.error}</p>
              )}

              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {formatDateTime(new Date(entry.timestamp), "en")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

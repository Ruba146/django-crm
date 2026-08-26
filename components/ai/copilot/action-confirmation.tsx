"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useTranslations } from "@/hooks/use-translations";
import type { AIAction } from "@/types/ai-chat";

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

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "due_at" || key === "target_close_date") {
    try {
      return new Date(value as string).toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (key === "expected_value_minor" && typeof value === "number") {
    return `${(value / 100).toFixed(2)} SAR`;
  }
  return String(value);
}

export function ActionConfirmation({
  action,
  open,
  onConfirm,
  onCancel,
  isExecuting,
}: {
  action: AIAction | null;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}) {
  const { t } = useTranslations();

  const params = useMemo(() => {
    if (!action) return [];
    return Object.entries(action.params)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([key, value]) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: formatValue(key, value),
      }));
  }, [action]);

  const title = action ? `Confirm: ${ACTION_LABELS[action.type] || action.type}` : "Confirm Action";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      dismissible={!isExecuting}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-4 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            <X className="size-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExecuting}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-success px-4 text-sm text-white transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            <Check className="size-4" />
            {isExecuting ? "Executing..." : "Confirm"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("copilot.actionConfirmHint", "I am about to perform the following action. Please confirm to proceed.")}
        </p>

        {params.length > 0 && (
          <div className="space-y-2">
            {params.map(({ key, label, value }) => (
              <div
                key={key}
                className="flex items-start justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground text-right max-w-[60%] break-words">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

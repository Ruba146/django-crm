"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ActionType =
  | "create_task"
  | "create_activity"
  | "create_note"
  | "create_deal"
  | "schedule_followup";

interface ActionDef {
  type: ActionType;
  label: string;
  requiresEntity: boolean;
}

const CUSTOMER_ACTIONS: ActionDef[] = [
  { type: "create_task", label: "Task", requiresEntity: true },
  { type: "create_activity", label: "Activity", requiresEntity: true },
  { type: "create_note", label: "Note", requiresEntity: true },
  { type: "create_deal", label: "Deal", requiresEntity: true },
  { type: "schedule_followup", label: "Follow-up", requiresEntity: true },
];

const LEAD_ACTIONS: ActionDef[] = [
  { type: "create_task", label: "Task", requiresEntity: true },
  { type: "create_activity", label: "Activity", requiresEntity: true },
  { type: "create_note", label: "Note", requiresEntity: true },
  { type: "create_deal", label: "Deal", requiresEntity: true },
  { type: "schedule_followup", label: "Follow-up", requiresEntity: true },
];

const DEAL_ACTIONS: ActionDef[] = [
  { type: "create_task", label: "Task", requiresEntity: true },
  { type: "create_activity", label: "Activity", requiresEntity: true },
  { type: "create_note", label: "Note", requiresEntity: true },
  { type: "schedule_followup", label: "Follow-up", requiresEntity: true },
];

const TASK_ACTIONS: ActionDef[] = [
  { type: "create_note", label: "Note", requiresEntity: true },
  { type: "create_activity", label: "Activity", requiresEntity: true },
];

interface RecordActionsProps {
  recordType: "customer" | "lead" | "deal" | "task";
  recordId: string;
  recordName?: string;
  onActionComplete?: () => void;
}

export function RecordActions({
  recordType,
  recordId,
  recordName,
  onActionComplete,
}: RecordActionsProps) {
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [expectedValue, setExpectedValue] = useState("");

  const actions =
    recordType === "customer"
      ? CUSTOMER_ACTIONS
      : recordType === "lead"
        ? LEAD_ACTIONS
        : recordType === "deal"
          ? DEAL_ACTIONS
          : TASK_ACTIONS;

  const resetForm = () => {
    setTitle("");
    setBody("");
    setDueAt("");
    setExpectedValue("");
    setError(null);
  };

  const handleOpen = (type: ActionType) => {
    setActionType(type);
    resetForm();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setActionType(null);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!actionType) return;
    setSubmitting(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
        entity_type: recordType,
        entity_id: recordId,
      };

      switch (actionType) {
        case "create_task":
          if (!title.trim()) {
            setError("Title is required");
            setSubmitting(false);
            return;
          }
          params.title = title.trim();
          if (dueAt) params.due_at = dueAt;
          break;
        case "create_activity":
          if (!body.trim()) {
            setError("Body is required");
            setSubmitting(false);
            return;
          }
          params.body = body.trim();
          break;
        case "create_note":
          if (!body.trim()) {
            setError("Body is required");
            setSubmitting(false);
            return;
          }
          params.body = body.trim();
          break;
        case "create_deal":
          if (!title.trim()) {
            setError("Deal name is required");
            setSubmitting(false);
            return;
          }
          params.name = title.trim();
          if (expectedValue) {
            const minor = Math.round(Number(expectedValue) * 100);
            params.expected_value_minor = minor > 0 ? minor : null;
          }
          break;
        case "schedule_followup":
          if (!title.trim()) {
            setError("Title is required");
            setSubmitting(false);
            return;
          }
          if (!dueAt) {
            setError("Due date is required");
            setSubmitting(false);
            return;
          }
          params.title = title.trim();
          params.due_at = dueAt;
          break;
      }

      const response = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { type: actionType, params } }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || "Action failed");
        return;
      }

      handleClose();
      onActionComplete?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getFields = () => {
    if (!actionType) return null;

    switch (actionType) {
      case "create_task":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Title <span className="text-danger">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </>
        );
      case "create_activity":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Activity <span className="text-danger">*</span>
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened?"
              rows={3}
              autoFocus
            />
          </div>
        );
      case "create_note":
        return (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Note <span className="text-danger">*</span>
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              autoFocus
            />
          </div>
        );
      case "create_deal":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Deal Name <span className="text-danger">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deal name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Expected Value (SAR)</label>
              <Input
                type="number"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>
        );
      case "schedule_followup":
        return (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Title <span className="text-danger">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Follow-up title"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Due Date <span className="text-danger">*</span>
              </label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const actionLabel = actionType
    ? actionType
        .replace("create_", "Create ")
        .replace("schedule_", "Schedule ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  const descriptionText = recordName
    ? `This will be associated with ${recordName}.`
    : `This will be associated with the current ${recordType}.`;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.type}
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => handleOpen(action.type)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {action.label}
          </Button>
        ))}
      </div>

      <Modal
        open={open}
        onClose={handleClose}
        title={actionLabel}
        description={descriptionText}
        footer={
          <>
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">{getFields()}</div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </Modal>
    </>
  );
}

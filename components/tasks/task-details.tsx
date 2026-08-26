"use client";

import {
  Building2,
  CalendarRange,
  CheckCircle2,
  MessageSquareText,
  Sparkles,
  Timer,
  User,
  X,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { formatDate } from "@/utils/format";
import type { TaskDetail, TaskRelatedRecord } from "@/types";
import type { TaskAnalysis } from "@/services/ai-analysis.service";
import { RecordAiInsights } from "@/components/ai/record-ai-insights";
import { RecordActions } from "@/components/ai/record-actions";

function colorText(color: string | null) {
  return color ? { borderColor: color, color } : undefined;
}

/** A small labelled value row used in the details panel. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Related record summary shown in the task detail modal.
 */
function RelatedRecordCard({ record }: { record: TaskRelatedRecord }) {
  const color = colorText(record.stageColor);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          Related Record
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Avatar name={record.name ?? "?"} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium">{record.name ?? "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{record.entity_type}</Badge>
              {record.stageLabel && (
                <Badge variant="outline" style={color}>
                  {record.stageLabel}
                </Badge>
              )}
              {record.companyName && (
                <Badge variant="neutral">{record.companyName}</Badge>
              )}
            </div>
            {record.ownerName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Owner: {record.ownerName}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Task detail panel — shown inside the centered modal.
 */
export function TaskDetails({
  record,
  relatedRecord,
  analysis,
  onClose,
  onActionComplete,
}: {
  record: TaskDetail;
  relatedRecord: TaskRelatedRecord | null;
  analysis?: TaskAnalysis | null;
  onClose?: () => void;
  onActionComplete?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={record.title ?? "?"} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {record.title ?? "Unnamed task"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={record.status === "completed" ? "success" : "warning"}>
                  {record.status === "completed" ? "Completed" : "Open"}
                </Badge>
                {record.taskTypeLabel && (
                  <Badge variant="outline" style={colorText(record.taskTypeColor)}>
                    {record.taskTypeLabel}
                  </Badge>
                )}
                {record.companyName && (
                  <Badge variant="neutral">{record.companyName}</Badge>
                )}
                {record.isAiCopy && (
                  <Badge variant="neutral" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    AI Copy
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close details"
              className="-me-1 -mt-1 shrink-0"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
              Task Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <InfoRow label="Title" value={record.title} />
              <InfoRow label="Description" value={record.description} />
              <InfoRow
                label="Assignee"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {record.assigneeName ?? "—"}
                  </span>
                }
              />
              <InfoRow
                label="Task Type"
                value={
                  record.taskTypeLabel ? (
                    <Badge variant="outline" style={colorText(record.taskTypeColor)}>
                      {record.taskTypeLabel}
                    </Badge>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Due Date"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Timer className="size-3.5 text-muted-foreground" />
                    {record.due_at ? formatDate(record.due_at) : "—"}
                  </span>
                }
              />
              <InfoRow
                label="Completed Date"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-muted-foreground" />
                    {record.completed_at ? formatDate(record.completed_at) : "—"}
                  </span>
                }
              />
              <InfoRow
                label="Mode"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquareText className="size-3.5 text-muted-foreground" />
                    {record.mode ?? "—"}
                  </span>
                }
              />
              <InfoRow
                label="Outcome"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-muted-foreground" />
                    {record.outcome ?? "—"}
                  </span>
                }
              />
              <InfoRow
                label="Created"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-3.5 text-muted-foreground" />
                    {formatDate(record.created_at)}
                  </span>
                }
              />
            </dl>
          </CardContent>
        </Card>

        {relatedRecord && <RelatedRecordCard record={relatedRecord} />}

        <RecordAiInsights
          type="task"
          analysis={analysis ?? null}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              AI Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecordActions
              recordType="task"
              recordId={record.id}
              recordName={record.title ?? undefined}
              onActionComplete={onActionComplete}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Task timeline is displayed in the Activities module.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

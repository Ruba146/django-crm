"use client";

import { useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Sparkles,
  Target,
  User,
  Users,
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
import { formatDateTime } from "@/utils/format";
import type {
  ActivityRecordDetail,
  ActivityTimelineItem,
} from "@/types";
import { ENTITY_TYPE_LABELS } from "./activity-filters";

const TIMELINE_PAGE_SIZE = 100;

function colorText(color: string | null) {
  return color ? { borderColor: color, color } : undefined;
}

/** Format a duration in seconds as "Xm Ys". */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
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

/** Pick an icon for a timeline activity type label. */
function activityIcon(label: string | null) {
  const l = (label ?? "").toLowerCase();
  if (l.includes("call"))
    return <Phone className="size-4" aria-hidden="true" />;
  if (l.includes("meeting"))
    return <Users className="size-4" aria-hidden="true" />;
  if (l.includes("email"))
    return <Mail className="size-4" aria-hidden="true" />;
  if (l.includes("whatsapp") || l.includes("what's app"))
    return <MessageSquareText className="size-4" aria-hidden="true" />;
  if (l.includes("demo"))
    return <Target className="size-4" aria-hidden="true" />;
  if (l.includes("task") || l.includes("todo"))
    return <CheckCircle2 className="size-4" aria-hidden="true" />;
  return <MessageSquareText className="size-4" aria-hidden="true" />;
}

/** A single timeline entry rendered as a card on a vertical line. */
function TimelineItem({ entry }: { entry: ActivityTimelineItem }) {
  const isTask = entry.kind === "task";
  const color = entry.activity_type_color ?? "var(--primary)";

  return (
    <li className="relative flex gap-4">
      {/* Left rail dot + line */}
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card"
          style={{
            backgroundColor: color,
            color: "#fff",
          }}
        >
          {activityIcon(entry.activity_type_label)}
        </span>
        <span
          aria-hidden="true"
          className="w-px flex-1 bg-border"
        />
      </div>

      {/* Card */}
      <div className="mb-4 min-w-0 flex-1 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={colorText(entry.activity_type_color)}
            >
              {entry.activity_type_label ?? (isTask ? "Task" : "Activity")}
            </Badge>
            {isTask && (
              <Badge variant="neutral">Task</Badge>
            )}
            {entry.isAiCopy && (
              <Badge variant="neutral" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                AI
              </Badge>
            )}
          </div>
          <time
            dateTime={entry.occurred_at ?? undefined}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Clock className="size-3.5" aria-hidden="true" />
            {entry.occurred_at ? formatDateTime(entry.occurred_at) : "—"}
          </time>
        </div>

        {entry.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {entry.body}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {entry.user_name && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" aria-hidden="true" />
              {entry.user_name}
            </span>
          )}
          {entry.direction && (
            <span className="inline-flex items-center gap-1">
              {entry.direction === "inbound" ? (
                <PhoneIncoming className="size-3.5" aria-hidden="true" />
              ) : (
                <PhoneOutgoing className="size-3.5" aria-hidden="true" />
              )}
              {entry.direction.charAt(0).toUpperCase() + entry.direction.slice(1)}
            </span>
          )}
          {entry.outcome && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {entry.outcome}
            </span>
          )}
          {entry.duration_seconds != null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatDuration(entry.duration_seconds)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Activity timeline details panel — shown inside the slide-over drawer.
 *
 * Displays a rich record header plus a complete vertical timeline of all
 * activities and tasks, ordered newest first. When there are more than
 * TIMELINE_PAGE_SIZE entries, a Load More button reveals the rest.
 */
export function ActivityDetails({
  record,
  timeline,
}: {
  record: ActivityRecordDetail;
  timeline: ActivityTimelineItem[];
}) {
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const hasMore = timeline.length > visibleCount;
  const visibleTimeline = timeline.slice(0, visibleCount);

  const loadMore = () => {
    setVisibleCount((prev) => prev + TIMELINE_PAGE_SIZE);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Record Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-start gap-4">
          <Avatar name={record.name ?? "?"} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {record.name ?? "Unnamed record"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {record.entity_type && (
                <Badge variant="outline">
                  {ENTITY_TYPE_LABELS[record.entity_type] ?? record.entity_type}
                </Badge>
              )}
              {record.stage && (
                <Badge variant="outline" style={colorText(record.stage.color)}>
                  {record.stage.label}
                </Badge>
              )}
              {record.company && (
                <Badge variant="neutral">{record.company}</Badge>
              )}
              {record.isAiCopy && (
                <Badge variant="neutral" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  AI Copy
                </Badge>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoRow
                label="Owner"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    {record.ownerName ?? "—"}
                  </span>
                }
              />
              <InfoRow
                label="Phone"
                value={
                  record.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" />
                      {record.phone}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Email"
                value={
                  record.email ? (
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                      {record.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Source"
                value={
                  record.source ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Target className="size-3.5 text-muted-foreground" />
                      {record.source.label}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
              Activity Timeline
              {timeline.length ? ` (${timeline.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <>
                <ul className="space-y-0">
                  {visibleTimeline.map((entry) => (
                    <TimelineItem key={entry.id} entry={entry} />
                  ))}
                </ul>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadMore}
                      className="gap-2"
                    >
                      <Loader2 className="size-4" aria-hidden="true" />
                      Load More ({timeline.length - visibleCount} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* AI placeholder */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-transparent"
          />
          <div className="relative space-y-3 p-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
              <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary-500" aria-hidden="true" />
                Coming soon
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquareText className="size-3.5" aria-hidden="true" />
                  <span className="text-xs">Sentiment Analysis</span>
                </div>
                <p className="mt-1 text-lg font-semibold tracking-tight">—</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleDollarSign className="size-3.5" aria-hidden="true" />
                  <span className="text-xs">Conversation Summary</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Automatic summary will appear here.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Suggested Next Action
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                AI-powered guidance will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

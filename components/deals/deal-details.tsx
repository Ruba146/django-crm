"use client";

import { useState } from "react";
import {
  Banknote,
  Building2,
  CalendarRange,
  CircleDollarSign,
  Sparkles,
  Timer,
  User,
  Link2,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import type { DealActivity, DealDetail, DealTask } from "@/types";
import type { DealAnalysis } from "@/services/ai-analysis.service";
import { RecordAiInsights, StructuredActionCard } from "@/components/ai/record-ai-insights";
import { RecordActions } from "@/components/ai/record-actions";
import { RelationshipIntelligencePanel } from "@/components/relationship-intelligence/relationship-intelligence-panel";

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
 * Deal details panel — the right-hand side of the split view.
 * Shows deal information, AI insights, timeline (activities) and tasks.
 * Presentational; data is passed in as props.
 */
export function DealDetails({
  deal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activities: _activities,
  tasks,
  analysis,
  locale = "en",
  onActionComplete,
}: {
  deal: DealDetail;
  activities?: DealActivity[];
  tasks: DealTask[];
  analysis?: DealAnalysis | null;
  locale?: string;
  onActionComplete?: () => void;
}) {
  const color = (c: string | null) => colorText(c);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar name={deal.name ?? "?"} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {deal.name ?? "Unnamed deal"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {deal.stage && (
                <Badge variant="outline" style={color(deal.stage.color)}>
                  {deal.stage.label}
                </Badge>
              )}
              {deal.status && (
                <Badge variant="outline" style={color(deal.stage?.color ?? null)}>
                  {deal.status}
                </Badge>
              )}
              {deal.isAiCopy && (
                <Badge variant="neutral" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  AI Copy
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks{tasks.length ? ` (${tasks.length})` : ""}
            </TabsTrigger>
            {deal.leadName && (
              <TabsTrigger value="related-lead">Related Lead</TabsTrigger>
            )}
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CircleDollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
                  Deal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <InfoRow
                    label="Name"
                    value={
                      deal.name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Banknote className="size-3.5 text-muted-foreground" />
                          {deal.name}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Company"
                    value={
                      deal.company ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          {deal.company}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Lead"
                    value={
                      deal.leadName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="size-3.5 text-muted-foreground" />
                          {deal.leadName}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow label="Owner" value={deal.ownerName} />
                  <InfoRow
                    label="Stage"
                    value={
                      deal.stage ? (
                        <Badge variant="outline" style={color(deal.stage.color)}>
                          {deal.stage.label}
                        </Badge>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Expected Value"
                    value={
                      deal.expected_value_minor != null ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                          <Banknote className="size-3.5 text-muted-foreground" />
                          {formatCurrency(
                            deal.expected_value_minor,
                            deal.currency_code ?? "SAR",
                            locale
                          )}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Probability"
                    value={
                      deal.probability_pct != null
                        ? `${deal.probability_pct}%`
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Currency"
                    value={deal.currency_code ?? "SAR"}
                  />
                  <InfoRow
                    label="Target Close"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="size-3.5 text-muted-foreground" />
                        {formatDate(deal.target_close_date, locale)}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Created"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="size-3.5 text-muted-foreground" />
                        {formatDate(deal.created_at, locale)}
                      </span>
                    }
                  />
                </dl>
                {deal.notes && (
                  <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {deal.notes}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Compact AI status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                  AI Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis ? (
                  <div className="flex items-center gap-2">
                    {analysis.evidenceQuality && evidenceQualityBadge(analysis.evidenceQuality)}
                    {healthBadge(analysis.health)}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Insufficient data to generate analysis.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relationships">
            <RelationshipIntelligencePanel entityType="deal" entityId={deal.id} />
          </TabsContent>

          <TabsContent value="ai-analysis">
            <RecordAiInsights type="deal" analysis={analysis ?? null} />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tasks yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id ?? "task"}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.title ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.task_type_label ?? "—"} · {formatDate(t.due_at, locale)}
                      </p>
                    </div>
                    {t.completed_at ? (
                      <span className="shrink-0 text-xs font-medium text-success">
                        Done
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-warning">
                        Open
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {deal.leadName && (
            <TabsContent value="related-lead" className="space-y-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />
                    Related Lead
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar name={deal.leadName} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{deal.leadName}</p>
                      <p className="text-xs text-muted-foreground">Lead</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="actions" className="space-y-4">
            {analysis?.recommendedAction && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                    Recommended Action
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StructuredActionCard action={analysis.recommendedAction} onActionComplete={onActionComplete} />
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                  AI Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecordActions
                  recordType="deal"
                  recordId={deal.id}
                  recordName={deal.name ?? undefined}
                  onActionComplete={onActionComplete}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function healthBadge(health: string) {
  switch (health) {
    case "healthy":
      return <Badge variant="success">Healthy</Badge>;
    case "at-risk":
      return <Badge variant="warning">At Risk</Badge>;
    case "stalled":
      return <Badge variant="warning">Stalled</Badge>;
    case "critical":
      return <Badge variant="danger">Critical</Badge>;
    case "stale":
      return <Badge variant="warning">Stale</Badge>;
    case "cold":
      return <Badge variant="danger">Cold</Badge>;
    default:
      return <Badge variant="outline">{health}</Badge>;
  }
}

function evidenceQualityBadge(quality: string) {
  switch (quality) {
    case "strong":
      return <Badge variant="success">Strong Evidence</Badge>;
    case "medium":
      return <Badge variant="warning">Medium Evidence</Badge>;
    case "weak":
      return <Badge variant="warning">Weak Evidence</Badge>;
    case "missing":
      return <Badge variant="outline">Missing Evidence</Badge>;
    default:
      return null;
  }
}

"use client";

import { useState } from "react";
import {
  Building2,
  CalendarRange,
  Mail,
  Phone,
  Sparkles,
  User,
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
import type { LeadActivity, LeadDeal, LeadDetail, LeadTask } from "@/types";
import type { LeadAnalysis } from "@/services/ai-analysis.service";
import { RecordAiInsights, StructuredActionCard } from "@/components/ai/record-ai-insights";
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
 * Lead details panel — the right-hand side of the split view.
 * Shows lead information, timeline (activities), deals, tasks and AI insights.
 * Presentational; data is passed in as props.
 */
export function LeadDetails({
  lead,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activities: _activities,
  deals,
  tasks,
  analysis,
  locale = "en",
  onActionComplete,
}: {
  lead: LeadDetail;
  activities?: LeadActivity[];
  deals: LeadDeal[];
  tasks: LeadTask[];
  analysis?: LeadAnalysis | null;
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
          <Avatar name={lead.full_name ?? "?"} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {lead.full_name ?? "Unnamed lead"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {lead.source && (
                <Badge variant="outline" style={color(lead.source.color)}>
                  {lead.source.label}
                </Badge>
              )}
              {lead.stage && (
                <Badge variant="outline" style={color(lead.stage.color)}>
                  {lead.stage.label}
                </Badge>
              )}
              {lead.isAiCopy && (
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
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks{tasks.length ? ` (${tasks.length})` : ""}
            </TabsTrigger>
            {deals.length > 0 && (
              <TabsTrigger value="related-deals">
                Related Deals{deals.length ? ` (${deals.length})` : ""}
              </TabsTrigger>
            )}
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" aria-hidden="true" />
                  Lead Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <InfoRow label="Name" value={lead.full_name} />
                  <InfoRow
                    label="Company"
                    value={
                      lead.company ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          {lead.company}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Phone"
                    value={
                      lead.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-muted-foreground" />
                          {lead.phone}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Email"
                    value={
                      lead.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3.5 text-muted-foreground" />
                          <span className="truncate">{lead.email}</span>
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow label="Owner" value={lead.ownerName} />
                  <InfoRow
                    label="Source"
                    value={
                      lead.source ? (
                        <Badge variant="outline" style={color(lead.source.color)}>
                          {lead.source.label}
                        </Badge>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Stage"
                    value={
                      lead.stage ? (
                        <Badge variant="outline" style={color(lead.stage.color)}>
                          {lead.stage.label}
                        </Badge>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Created"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="size-3.5 text-muted-foreground" />
                        {formatDate(lead.created_at, locale)}
                      </span>
                    }
                  />
                </dl>
                {lead.notes && (
                  <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {lead.notes}
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

          <TabsContent value="ai-analysis">
            <RecordAiInsights type="lead" analysis={analysis ?? null} />
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
                      <p className="truncate text-sm font-medium">{t.title ?? "—"}</p>
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

          {deals.length > 0 && (
            <TabsContent value="related-deals" className="space-y-2">
              {deals.map((d) => (
                <Card key={d.id ?? "deal"}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.stage_label ?? "—"} ·{" "}
                          {d.expected_value_minor != null
                            ? formatCurrency(
                                d.expected_value_minor,
                                d.currency_code ?? "SAR",
                                locale
                              )
                            : "No value"}
                        </p>
                      </div>
                      {d.status && (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {d.status}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  recordType="lead"
                  recordId={lead.id}
                  recordName={lead.full_name ?? undefined}
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

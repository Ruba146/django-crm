"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
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
import type {
  Contact,
  CustomerActivity,
  CustomerDeal,
  CustomerDetail,
  CustomerStatistics,
  CustomerTask,
} from "@/types";
import type { CustomerAnalysis } from "@/services/ai-analysis.service";
import { CustomerStatSummary } from "./customer-statistics";
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
 * Customer details panel — the right-hand side of the split view.
 * Shows the customer profile, stats, contacts, deals, activities and tasks.
 * Presentational; data is passed in as props.
 */
export function CustomerDetails({
  customer,
  stats,
  contacts,
  deals,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activities: _activities,
  tasks,
  analysis,
  locale = "en",
  onClose,
  onActionComplete,
}: {
  customer: CustomerDetail;
  stats: CustomerStatistics | null;
  contacts: Contact[];
  deals: CustomerDeal[];
  activities?: CustomerActivity[];
  tasks: CustomerTask[];
  analysis?: CustomerAnalysis | null;
  locale?: string;
  onClose?: () => void;
  onActionComplete?: () => void;
}) {
  const color = (c: string | null) => colorText(c);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name ?? "?"} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {customer.name ?? "Unnamed customer"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {customer.industry && (
                <Badge variant="outline" style={color(customer.industry.color)}>
                  {customer.industry.label}
                </Badge>
              )}
              {customer.status && (
                <Badge variant="outline" style={color(customer.status.color)}>
                  {customer.status.label}
                </Badge>
              )}
              {customer.isAiCopy && (
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
            className="-me-1 -mt-1"
          >
            <X className="size-4" />
          </Button>
        )}
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
            {deals.length > 0 && (
              <TabsTrigger value="related-deals">
                Related Deals{deals.length ? ` (${deals.length})` : ""}
              </TabsTrigger>
            )}
            {contacts.length > 0 && (
              <TabsTrigger value="related-contacts">
                Contacts{contacts.length ? ` (${contacts.length})` : ""}
              </TabsTrigger>
            )}
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {stats && <CustomerStatSummary stats={stats} locale={locale} />}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <InfoRow label="City" value={customer.city} />
                  <InfoRow label="Branches" value={customer.num_branches} />
                  <InfoRow label="POS" value={customer.num_pos} />
                  <InfoRow label="Warehouse" value={customer.has_warehouse ? "Yes" : "No"} />
                  <InfoRow label="Current system" value={customer.current_system} />
                  <InfoRow label="Owner" value={customer.ownerName} />
                  <InfoRow
                    label="Created"
                    value={formatDate(customer.created_at, locale)}
                  />
                  <InfoRow
                    label="Updated"
                    value={formatDate(customer.updated_at, locale)}
                  />
                </dl>
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
                    {healthBadge(analysis.riskLevel)}
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
            <RelationshipIntelligencePanel entityType="customer" entityId={customer.id} />
          </TabsContent>

          <TabsContent value="ai-analysis">
            <RecordAiInsights type="customer" analysis={analysis ?? null} />
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
                          {d.stage_label ?? "—"} · {d.probability_pct ?? 0}%
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatCurrency(
                          d.expected_value_minor,
                          d.currency_code ?? "SAR",
                          locale
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {contacts.length > 0 && (
            <TabsContent value="related-contacts" className="space-y-2">
              {contacts.map((c) => (
                <Card key={c.id ?? c.email ?? "contact"}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.full_name ?? "?"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.full_name ?? "Unnamed"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.role, c.email, c.phone].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                      </div>
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
                  recordType="customer"
                  recordId={customer.id}
                  recordName={customer.name ?? undefined}
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
    case "low":
      return <Badge variant="success">Low Risk</Badge>;
    case "medium":
      return <Badge variant="warning">Medium Risk</Badge>;
    case "high":
      return <Badge variant="danger">High Risk</Badge>;
    case "critical":
      return <Badge variant="danger">Critical</Badge>;
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

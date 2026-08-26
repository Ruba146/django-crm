import { getAiData, getAiOverviewCards } from "@/services/ai.service";
import { generateGlobalActionRecommendations } from "@/services/ai-action-recommendation.service";
import { AiHeader } from "@/components/ai";
import { OverviewCards } from "@/components/ai";
import { ExecutiveSummary } from "@/components/ai";
import { AiInsights } from "@/components/ai";
import { Recommendations } from "@/components/ai";
import { RiskDeals } from "@/components/ai";
import { InactiveCustomers } from "@/components/ai";
import {
  DealIntelligence,
  CustomerIntelligence,
  LeadIntelligence,
  LossPatterns,
  ConversionPatterns,
  StageBottlenecks,
} from "@/components/ai";
import { EmbeddedCopilot } from "@/components/ai/copilot/embedded-copilot";
import type { AiData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  AlertCircle,
  AlertTriangle,
  Users,
  Clock,
  Phone,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface BriefingItem {
  entityType: string;
  entityId: string;
  entityName: string;
  priority: "critical" | "high" | "medium" | "low";
  priorityScore: number;
  reason: string;
  evidence: string[];
  recommendedAction: string;
  value?: number;
  currency?: string;
  daysSinceActivity?: number | null;
  openDeals?: number;
  daysOverdue?: number;
  relatedRecordValueMinor?: number | null;
  riskScore?: number;
  riskLevel?: "critical" | "high" | "medium" | "low";
  expectedValueMinor?: number | null;
  currencyCode?: string | null;
}

interface DailyBriefingData {
  executiveSummary: string;
  todayPriorities: BriefingItem[];
  atRiskDeals: BriefingItem[];
  customersRequiringAttention: BriefingItem[];
  overdueTasks: BriefingItem[];
  suggestedFollowUps: BriefingItem[];
  opportunities: BriefingItem[];
  employeeSummary: {
    overdueTasks: number;
    todayTasks: number;
    highPriorityDeals: number;
    customersNeedingAttention: number;
    leadsNeedingFollowUp: number;
    recommendedActions: string[];
  };
}

export default async function AIPage() {
  const data: AiData = getAiData();
  const overviewCards = getAiOverviewCards();
  const briefing = data.dailyBriefing as DailyBriefingData | undefined;
  const globalActions = generateGlobalActionRecommendations();

  return (
    <div className="space-y-6">
      <AiHeader />
      <OverviewCards cards={overviewCards} />

      {briefing && (
        <>
          <DailyBriefingSummary briefing={briefing} />

          <div className="grid gap-6 lg:grid-cols-2">
            <TodayPriorities priorities={briefing.todayPriorities} />
            <AtRiskDeals deals={briefing.atRiskDeals} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CustomersRequiringAttention customers={briefing.customersRequiringAttention} />
            <OverdueTasks tasks={briefing.overdueTasks} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FollowUpOpportunities opportunities={briefing.suggestedFollowUps} />
            <Opportunities opportunities={briefing.opportunities} />
          </div>

          <EmployeeSummary summary={briefing.employeeSummary} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-primary" aria-hidden="true" />
            Today&apos;s Top Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {globalActions.topPriority && (
              <div className={`rounded-lg border p-4 ${
                globalActions.topPriority.priority === "critical" ? "border-danger/30 bg-danger/5" :
                globalActions.topPriority.priority === "high" ? "border-warning/30 bg-warning/5" :
                "border-border bg-muted/20"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{globalActions.topPriority.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{globalActions.topPriority.reason}</p>
                    {globalActions.topPriority.evidence.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {globalActions.topPriority.evidence.slice(0, 3).map((e, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium uppercase tracking-wide">{globalActions.topPriority.priority}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{globalActions.topPriority.urgency?.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{globalActions.topPriority.confidence?.toUpperCase()} confidence</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {globalActions.byEntity.slice(1, 6).map((item, i) => (
              <div key={i} className={`rounded-lg border p-3 ${
                item.action.priority === "critical" ? "border-danger/30 bg-danger/5" :
                item.action.priority === "high" ? "border-warning/30 bg-warning/5" :
                "border-border bg-muted/20"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/${item.entityType}s/${item.entityId}`} className="text-sm font-medium hover:underline">
                        {item.entityName}
                      </Link>
                      <span className="text-xs text-muted-foreground capitalize">{item.entityType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.action.reason}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide">{item.action.priority}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{item.action.urgency?.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExecutiveSummary summary={data.executiveSummary} />

      {data.globalAnalysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-success" aria-hidden="true" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.globalAnalysis.topPerformers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium">{p.name || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{p.wonDeals} won</p>
                      <p className="text-xs text-muted-foreground">{p.conversionRate}% conversion</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AiInsights insights={data.insights} />
      <Recommendations recommendations={data.recommendations} />
      <RiskDeals riskDeals={data.riskDeals} />
      <InactiveCustomers inactiveCustomers={data.inactiveCustomers} />

      {briefing && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DealIntelligence
            priorities={briefing.todayPriorities.filter((p) => p.entityType === "deal")}
            riskDeals={data.riskDeals}
          />
          <CustomerIntelligence customers={briefing.customersRequiringAttention} />
          <LeadIntelligence
            leads={briefing.suggestedFollowUps.filter((f) => f.entityType === "lead")}
          />
        </div>
      )}

      {data.lossPatterns.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LossPatterns patterns={data.lossPatterns} />
          {data.conversionPatterns.length > 0 && (
            <ConversionPatterns patterns={data.conversionPatterns} />
          )}
        </div>
      )}

      {data.stageBottlenecks.length > 0 && <StageBottlenecks bottlenecks={data.stageBottlenecks} />}

      <EmbeddedCopilot />
    </div>
  );
}

function DailyBriefingSummary({ briefing }: { briefing: DailyBriefingData }) {
  const criticalCount = briefing.todayPriorities.filter((p) => p.priority === "critical").length;
  const highCount = briefing.todayPriorities.filter((p) => p.priority === "high").length;

  return (
    <Card className="border-l-4 border-l-primary-600">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary-600" aria-hidden="true" />
          AI Daily Briefing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{briefing.executiveSummary}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-danger" aria-hidden="true" />
            <span className="font-medium">{criticalCount + highCount}</span>
            <span className="text-muted-foreground">high-priority items</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
            <span className="font-medium">{briefing.atRiskDeals.length}</span>
            <span className="text-muted-foreground">at-risk deals</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-danger" aria-hidden="true" />
            <span className="font-medium">{briefing.overdueTasks.length}</span>
            <span className="text-muted-foreground">overdue tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-info" aria-hidden="true" />
            <span className="font-medium">{briefing.customersRequiringAttention.length}</span>
            <span className="text-muted-foreground">customers need attention</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayPriorities({ priorities }: { priorities: BriefingItem[] }) {
  if (!priorities || priorities.length === 0) return null;

  const priorityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    high: "text-warning border-warning/30 bg-warning/5",
    medium: "text-info border-info/30 bg-info/5",
    low: "text-muted-foreground border-border",
  };

  const entityLinks: Record<string, (id: string) => string> = {
    deal: (id) => `/deals/${id}`,
    customer: (id) => `/customers/${id}`,
    lead: (id) => `/leads/${id}`,
    task: (id) => `/tasks/${id}`,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="size-4 text-danger" aria-hidden="true" />
          Today&apos;s Priorities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorities.map((p, i) => (
            <div key={i} className={`rounded-lg border p-4 ${priorityColors[p.priority] || priorityColors.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={entityLinks[p.entityType]?.(p.entityId) || "#"} className="text-sm font-medium hover:underline">
                      {p.entityName}
                    </Link>
                    <span className="text-xs text-muted-foreground capitalize">{p.entityType}</span>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide">{p.priority} · Score: {p.priorityScore}</p>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                  {p.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {p.evidence.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs font-medium mt-2">Recommended: {p.recommendedAction}</p>
                </div>
                {p.value != null && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {(p.value / 100).toFixed(2)} {p.currency || "SAR"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AtRiskDeals({ deals }: { deals: BriefingItem[] }) {
  if (!deals || deals.length === 0) return null;

  const priorityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    high: "text-warning border-warning/30 bg-warning/5",
    medium: "text-info border-info/30 bg-info/5",
    low: "text-muted-foreground border-border",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          At-Risk Deals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deals.map((d) => (
            <div key={d.entityId} className={`rounded-lg border p-4 ${priorityColors[d.priority] || priorityColors.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/deals/${d.entityId}`} className="text-sm font-medium hover:underline">
                      {d.entityName}
                    </Link>
                    <span className="text-xs text-muted-foreground">Deal</span>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    {d.priority} · Risk Score: {d.riskScore ?? d.priorityScore}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.reason}</p>
                  {d.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {d.evidence.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs font-medium mt-2">Recommended: {d.recommendedAction}</p>
                </div>
                {d.expectedValueMinor != null && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {(d.expectedValueMinor / 100).toFixed(2)} {d.currencyCode || "SAR"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomersRequiringAttention({ customers }: { customers: BriefingItem[] }) {
  if (!customers || customers.length === 0) return null;

  const priorityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    high: "text-warning border-warning/30 bg-warning/5",
    medium: "text-info border-info/30 bg-info/5",
    low: "text-muted-foreground border-border",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-info" aria-hidden="true" />
          Customers Requiring Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {customers.map((c) => (
            <div key={c.entityId} className={`rounded-lg border p-4 ${priorityColors[c.priority] || priorityColors.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/customers/${c.entityId}`} className="text-sm font-medium hover:underline">
                      {c.entityName}
                    </Link>
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    {c.priority} · Score: {c.priorityScore}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                  {c.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {c.evidence.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs font-medium mt-2">Recommended: {c.recommendedAction}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{c.openDeals ?? 0} open</p>
                  {c.daysSinceActivity != null && (
                    <p className="text-xs text-muted-foreground">{c.daysSinceActivity}d inactive</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OverdueTasks({ tasks }: { tasks: BriefingItem[] }) {
  if (!tasks || tasks.length === 0) return null;

  const priorityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    high: "text-warning border-warning/30 bg-warning/5",
    medium: "text-info border-info/30 bg-info/5",
    low: "text-muted-foreground border-border",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-danger" aria-hidden="true" />
          Overdue Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.entityId} className={`rounded-lg border p-4 ${priorityColors[t.priority] || priorityColors.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/tasks/${t.entityId}`} className="text-sm font-medium hover:underline">
                      {t.entityName}
                    </Link>
                    <span className="text-xs text-muted-foreground">Task</span>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    {t.priority} · Score: {t.priorityScore}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                  {t.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {t.evidence.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs font-medium mt-2">Recommended: {t.recommendedAction}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{t.daysOverdue ?? 0}d overdue</p>
                  {t.relatedRecordValueMinor != null && (
                    <p className="text-xs text-muted-foreground">
                      {(t.relatedRecordValueMinor / 100).toFixed(2)} SAR
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FollowUpOpportunities({ opportunities }: { opportunities: BriefingItem[] }) {
  if (!opportunities || opportunities.length === 0) return null;

  const priorityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    high: "text-warning border-warning/30 bg-warning/5",
    medium: "text-info border-info/30 bg-info/5",
    low: "text-muted-foreground border-border",
  };

  const entityLinks: Record<string, (id: string) => string> = {
    customer: (id) => `/customers/${id}`,
    lead: (id) => `/leads/${id}`,
    deal: (id) => `/deals/${id}`,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="size-4 text-success" aria-hidden="true" />
          Follow-up Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.map((o) => (
            <div key={o.entityId} className={`rounded-lg border p-4 ${priorityColors[o.priority] || priorityColors.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={entityLinks[o.entityType]?.(o.entityId) || "#"} className="text-sm font-medium hover:underline">
                      {o.entityName}
                    </Link>
                    <span className="text-xs text-muted-foreground capitalize">{o.entityType}</span>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    {o.priority} · Score: {o.priorityScore}
                  </p>
                  <p className="text-xs text-muted-foreground">{o.reason}</p>
                  {o.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {o.evidence.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs font-medium mt-2">Recommended: {o.recommendedAction}</p>
                </div>
                {o.daysSinceActivity != null && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {o.daysSinceActivity}d since activity
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Opportunities({ opportunities }: { opportunities: BriefingItem[] }) {
  if (!opportunities || opportunities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-success" aria-hidden="true" />
          Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.map((o) => (
            <div key={o.entityId} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={o.entityType === "deal" ? `/deals/${o.entityId}` : `/leads/${o.entityId}`} className="text-sm font-medium hover:underline">
                    {o.entityName}
                  </Link>
                  <span className="text-xs text-muted-foreground capitalize">{o.entityType}</span>
                  <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground">{o.reason}</p>
                <p className="text-xs font-medium">Recommended: {o.recommendedAction}</p>
              </div>
              {o.expectedValueMinor != null && (
                <span className="text-sm font-medium whitespace-nowrap">
                  {(o.expectedValueMinor / 100).toFixed(2)} SAR
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeSummary({ summary }: { summary: DailyBriefingData["employeeSummary"] }) {
  return (
    <Card className="border-l-4 border-l-primary-600">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-primary-600" aria-hidden="true" />
          Your Daily Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{summary.overdueTasks}</p>
            <p className="text-xs text-muted-foreground">Overdue Tasks</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{summary.todayTasks}</p>
            <p className="text-xs text-muted-foreground">Today&apos;s Tasks</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{summary.highPriorityDeals}</p>
            <p className="text-xs text-muted-foreground">High-Priority Deals</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{summary.customersNeedingAttention}</p>
            <p className="text-xs text-muted-foreground">Customers Needing Attention</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Recommended Actions:</p>
          <ul className="space-y-1">
            {summary.recommendedActions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="size-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

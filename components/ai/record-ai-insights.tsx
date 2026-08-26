"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Shield,
  Activity,
  GitCompare,
  Brain,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { ActionConfirmation } from "@/components/ai/copilot/action-confirmation";
import type {
  CustomerAnalysis,
  DealAnalysis,
  LeadAnalysis,
  TaskAnalysis,
} from "@/services/ai-analysis.service";
import type { RecommendedAction } from "@/services/ai-action-recommendation.service";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

function riskBadge(level: string) {
  switch (level) {
    case "low":
      return <Badge variant="success">Low</Badge>;
    case "medium":
      return <Badge variant="warning">Medium</Badge>;
    case "high":
      return <Badge variant="danger">High</Badge>;
    case "critical":
      return <Badge variant="danger">Critical</Badge>;
    default:
      return <Badge variant="outline">{level}</Badge>;
  }
}

function confidenceBadge(confidence: "high" | "medium" | "low") {
  switch (confidence) {
    case "high":
      return <Badge variant="success">High</Badge>;
    case "medium":
      return <Badge variant="warning">Medium</Badge>;
    case "low":
      return <Badge variant="outline">Low</Badge>;
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

function priorityBadge(priority: "critical" | "high" | "medium" | "low") {
  switch (priority) {
    case "critical":
      return <Badge variant="danger">Critical</Badge>;
    case "high":
      return <Badge variant="warning">High</Badge>;
    case "medium":
      return <Badge variant="outline">Medium</Badge>;
    case "low":
      return <Badge variant="outline">Low</Badge>;
    default:
      return null;
  }
}

function urgencyBadge(urgency: "immediate" | "within_48h" | "within_week" | "routine") {
  switch (urgency) {
    case "immediate":
      return <Badge variant="danger">Immediate</Badge>;
    case "within_48h":
      return <Badge variant="warning">Within 48h</Badge>;
    case "within_week":
      return <Badge variant="outline">This Week</Badge>;
    case "routine":
      return <Badge variant="outline">Routine</Badge>;
    default:
      return null;
  }
}

function scoreColor(value: number | null | undefined) {
  if (value == null) return "text-foreground";
  if (value >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function pctColor(value: number | null | undefined) {
  if (value == null) return "text-foreground";
  if (value >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

/* ------------------------------------------------------------------ */
/* Metric Card                                                         */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  title: string;
  value: number | null | undefined;
  suffix?: string;
  level?: string;
  confidence?: "high" | "medium" | "low";
  explanation?: string;
  basis?: string[];
  onClick: () => void;
}

function MetricCard({ title, value, suffix = "", level, confidence, explanation, basis, onClick }: MetricCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onClick();
  };

  const displayValue = value != null ? `${value}${suffix}` : "—";
  const color = suffix === "%" ? pctColor(value) : scoreColor(value);

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full flex-col gap-1 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {confidence && confidenceBadge(confidence)}
        </div>
        <div className={`text-xl font-bold ${color}`}>{displayValue}</div>
        {level && <div className="text-xs text-foreground/70">{level}</div>}
      </button>
      {expanded && (explanation || (basis && basis.length > 0)) && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          {explanation && (
            <p className="text-xs leading-relaxed text-foreground/80">{explanation}</p>
          )}
          {basis && basis.length > 0 && (
            <div className="space-y-1">
              {basis.slice(0, 4).map((b, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-foreground/30" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Structured Action Card                                             */
/* ------------------------------------------------------------------ */

export function StructuredActionCard({ action, onActionComplete }: { action: RecommendedAction; onActionComplete?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!action.executableType) return;
    setExecuting(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (action.relatedRecord) {
        params.entity_type = action.relatedRecord.type;
        params.entity_id = action.relatedRecord.id;
      }
      if (action.executableType === "schedule_followup") {
        params.title = action.action;
        params.due_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      } else if (action.executableType === "create_task") {
        params.title = action.action;
      } else if (action.executableType === "create_activity") {
        params.body = action.action;
      } else if (action.executableType === "update_deal_stage") {
        params.deal_id = action.relatedRecord?.id || "";
        params.stage_id = "";
      }

      const response = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { type: action.executableType, params } }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        setError(result.error || "Action failed");
      } else {
        setConfirmOpen(false);
        onActionComplete?.();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">Recommended Action</span>
          <div className="flex items-center gap-1.5">
            {priorityBadge(action.priority)}
            {urgencyBadge(action.urgency)}
            {confidenceBadge(action.confidence)}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          <p className="text-sm font-medium text-foreground">{action.action}</p>
          <p className="text-xs text-muted-foreground">{action.reason}</p>
          {action.evidence.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Evidence
              </div>
              <ul className="space-y-1">
                {action.evidence.slice(0, 4).map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-foreground/30" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {action.expectedImpact.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="size-3" aria-hidden="true" />
                Expected Impact
              </div>
              <ul className="space-y-1">
                {action.expectedImpact.map((impact, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-foreground/30" />
                    <span>{impact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {action.negativeConsequence && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="size-3" aria-hidden="true" />
                If No Action Is Taken
              </div>
              <p className="text-xs text-foreground/70">{action.negativeConsequence}</p>
            </div>
          )}
          {action.relatedRecord && (
            <div className="text-xs text-muted-foreground">
              Related: <span className="font-medium text-foreground">{action.relatedRecord.name}</span>
              <span className="text-foreground/50"> ({action.relatedRecord.type})</span>
            </div>
          )}
          {action.executableType && (
            <div className="pt-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => setConfirmOpen(true)}
                disabled={executing}
              >
                {executing ? "Executing..." : "Execute Recommended Action"}
              </Button>
              {error && <p className="text-xs text-danger mt-1">{error}</p>}
            </div>
          )}
        </div>
      )}
      <ActionConfirmation
        action={action.executableType ? {
          id: crypto.randomUUID(),
          type: action.executableType,
          label: action.action,
          params: action.relatedRecord ? {
            entity_type: action.relatedRecord.type,
            entity_id: action.relatedRecord.id,
          } : {},
        } : null}
        open={confirmOpen}
        onConfirm={handleExecute}
        onCancel={() => setConfirmOpen(false)}
        isExecuting={executing}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customer Insights (Progressive Disclosure)                          */
/* ------------------------------------------------------------------ */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed text-foreground/80">
      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/30" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function ActionShortcuts({ entityType }: { entityType: string }) {
  const actions = [
    { label: "Log Activity", action: "log_activity" },
    { label: "Create Task", action: "create_task" },
    { label: "Add Note", action: "add_note" },
    { label: "Schedule Follow-up", action: "schedule_followup" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.action}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const event = new CustomEvent("ai-action-shortcut", { detail: { action: a.action, entityType } });
            window.dispatchEvent(event);
          }}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function CustomerInsights({ analysis }: { analysis: CustomerAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          {analysis.evidenceQuality && evidenceQualityBadge(analysis.evidenceQuality)}
          {healthBadge(analysis.riskLevel)}
        </div>
      </div>

      <Accordion>
        <AccordionItem title="Overview" icon={Building2}>
          <p className="text-xs leading-relaxed text-foreground/80">
            {analysis.overview}
          </p>
        </AccordionItem>

        {analysis.whatChanged && analysis.whatChanged !== "No significant change detected." && (
          <AccordionItem title="What Changed" icon={GitCompare}>
            <p className="text-xs leading-relaxed text-foreground/80">{analysis.whatChanged}</p>
          </AccordionItem>
        )}

        {analysis.behavioralPatterns && analysis.behavioralPatterns.length > 0 && (
          <AccordionItem title="Behavioral Patterns" icon={Activity}>
            <div className="space-y-2">
              {analysis.behavioralPatterns.map((pattern, i) => (
                <div key={i} className={`rounded-lg border p-2 ${
                  pattern.severity === "critical" ? "border-danger/30 bg-danger/5" :
                  pattern.severity === "warning" ? "border-warning/30 bg-warning/5" :
                  "border-border bg-muted/20"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{pattern.title}</span>
                    <Badge variant={pattern.severity === "critical" ? "danger" : pattern.severity === "warning" ? "warning" : "outline"}>
                      {pattern.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence: {pattern.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.contradictions && analysis.contradictions.length > 0 && (
          <AccordionItem title="Data Consistency Checks" icon={Shield}>
            <div className="space-y-1">
              {analysis.contradictions.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.dataQualityWarnings && analysis.dataQualityWarnings.length > 0 && (
          <AccordionItem title="Data Quality Notes" icon={Activity}>
            <div className="space-y-1">
              {analysis.dataQualityWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/30" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.predictions && (
          <AccordionItem title="Predictions" icon={BarChart3}>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                title={analysis.predictions.churnRisk.label}
                value={analysis.predictions.churnRisk.value}
                suffix="%"
                confidence={analysis.predictions.churnRisk.confidence}
                explanation={analysis.predictions.churnRisk.explanation}
                basis={analysis.predictions.churnRisk.basis}
                onClick={() => {}}
              />
              <MetricCard
                title={analysis.predictions.followUpPriority.label}
                value={analysis.predictions.followUpPriority.value}
                suffix="%"
                confidence={analysis.predictions.followUpPriority.confidence}
                explanation={analysis.predictions.followUpPriority.explanation}
                basis={analysis.predictions.followUpPriority.basis}
                onClick={() => {}}
              />
              <MetricCard
                title={analysis.predictions.engagementScore.label}
                value={analysis.predictions.engagementScore.value}
                suffix="%"
                confidence={analysis.predictions.engagementScore.confidence}
                explanation={analysis.predictions.engagementScore.explanation}
                basis={analysis.predictions.engagementScore.basis}
                onClick={() => {}}
              />
            </div>
          </AccordionItem>
        )}

        {analysis.enhancedPredictions && (
          <AccordionItem title="Advanced Predictive Intelligence" icon={Brain}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Relationship Health</div>
                  <div className="mt-1 text-xl font-bold">{analysis.enhancedPredictions.relationshipHealth.score}/100</div>
                  <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.relationshipHealth.level}</div>
                  <ul className="mt-2 space-y-1">
                    {analysis.enhancedPredictions.relationshipHealth.factors.slice(0, 3).map((f, i) => (
                      <Bullet key={i}>{f}</Bullet>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Opportunity Score</div>
                  <div className="mt-1 text-xl font-bold">{analysis.enhancedPredictions.opportunityScore.score}/100</div>
                  <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.opportunityScore.level}</div>
                  <ul className="mt-2 space-y-1">
                    {analysis.enhancedPredictions.opportunityScore.factors.slice(0, 3).map((f, i) => (
                      <Bullet key={i}>{f}</Bullet>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Next Best Action</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.nextBestAction.action}</div>
                <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.nextBestAction.why}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Data Quality</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.dataQuality.score}% — {analysis.enhancedPredictions.dataQuality.impactOnConfidence}</div>
                {analysis.enhancedPredictions.dataQuality.missingFields.length > 0 && (
                  <div className="mt-1 text-xs text-danger">Missing: {analysis.enhancedPredictions.dataQuality.missingFields.join(", ")}</div>
                )}
              </div>
            </div>
          </AccordionItem>
        )}

        {analysis.evidence.length > 0 && (
          <AccordionItem title="Evidence" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {analysis.evidence.map((e, i) => (
                <Bullet key={i}>{e}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.riskReasons.length > 0 && (
          <AccordionItem title="Risks" icon={AlertTriangle}>
            <ul className="space-y-1.5">
              {analysis.riskReasons.map((r, i) => (
                <Bullet key={i}>{r}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.opportunityReasons.length > 0 && (
          <AccordionItem title="Opportunities" icon={TrendingUp}>
            <ul className="space-y-1.5">
              {analysis.opportunityReasons.map((o, i) => (
                <Bullet key={i}>{o}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.recommendedActions.length > 0 && (
          <AccordionItem title="Quick Actions" icon={Target}>
            <ActionShortcuts entityType="customer" />
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lead Insights (Progressive Disclosure)                             */
/* ------------------------------------------------------------------ */

function LeadInsights({ analysis }: { analysis: LeadAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          {analysis.evidenceQuality && evidenceQualityBadge(analysis.evidenceQuality)}
          {healthBadge(analysis.health)}
        </div>
      </div>

      <Accordion>
        <AccordionItem title="Overview" icon={User}>
          <p className="text-xs leading-relaxed text-foreground/80">
            {analysis.overview}
          </p>
        </AccordionItem>

        {analysis.whatChanged && analysis.whatChanged !== "No significant change detected." && (
          <AccordionItem title="What Changed" icon={GitCompare}>
            <p className="text-xs leading-relaxed text-foreground/80">{analysis.whatChanged}</p>
          </AccordionItem>
        )}

        {analysis.behavioralPatterns && analysis.behavioralPatterns.length > 0 && (
          <AccordionItem title="Behavioral Patterns" icon={Activity}>
            <div className="space-y-2">
              {analysis.behavioralPatterns.map((pattern, i) => (
                <div key={i} className={`rounded-lg border p-2 ${
                  pattern.severity === "critical" ? "border-danger/30 bg-danger/5" :
                  pattern.severity === "warning" ? "border-warning/30 bg-warning/5" :
                  "border-border bg-muted/20"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{pattern.title}</span>
                    <Badge variant={pattern.severity === "critical" ? "danger" : pattern.severity === "warning" ? "warning" : "outline"}>
                      {pattern.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence: {pattern.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.contradictions && analysis.contradictions.length > 0 && (
          <AccordionItem title="Data Consistency Checks" icon={Shield}>
            <div className="space-y-1">
              {analysis.contradictions.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.dataQualityWarnings && analysis.dataQualityWarnings.length > 0 && (
          <AccordionItem title="Data Quality Notes" icon={Activity}>
            <div className="space-y-1">
              {analysis.dataQualityWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/30" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.predictions && (
          <AccordionItem title="Predictions" icon={BarChart3}>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                title={analysis.predictions.conversionProbability.label}
                value={analysis.predictions.conversionProbability.value}
                suffix="%"
                confidence={analysis.predictions.conversionProbability.confidence}
                explanation={analysis.predictions.conversionProbability.explanation}
                basis={analysis.predictions.conversionProbability.basis}
                onClick={() => {}}
              />
              <MetricCard
                title={analysis.predictions.followUpPriority.label}
                value={analysis.predictions.followUpPriority.value}
                suffix="%"
                confidence={analysis.predictions.followUpPriority.confidence}
                explanation={analysis.predictions.followUpPriority.explanation}
                basis={analysis.predictions.followUpPriority.basis}
                onClick={() => {}}
              />
              <MetricCard
                title={analysis.predictions.engagementScore.label}
                value={analysis.predictions.engagementScore.value}
                suffix="%"
                confidence={analysis.predictions.engagementScore.confidence}
                explanation={analysis.predictions.engagementScore.explanation}
                basis={analysis.predictions.engagementScore.basis}
                onClick={() => {}}
              />
            </div>
          </AccordionItem>
        )}

        {analysis.enhancedPredictions && (
          <AccordionItem title="Advanced Predictive Intelligence" icon={Brain}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Lead Health</div>
                  <div className="mt-1 text-xl font-bold">{analysis.enhancedPredictions.leadHealth.score}/100</div>
                  <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.leadHealth.level}</div>
                  <ul className="mt-2 space-y-1">
                    {analysis.enhancedPredictions.leadHealth.factors.slice(0, 3).map((f, i) => (
                      <Bullet key={i}>{f}</Bullet>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Opportunity Score</div>
                  <div className="mt-1 text-xl font-bold">{analysis.enhancedPredictions.opportunityScore.score}/100</div>
                  <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.opportunityScore.level}</div>
                  <ul className="mt-2 space-y-1">
                    {analysis.enhancedPredictions.opportunityScore.factors.slice(0, 3).map((f, i) => (
                      <Bullet key={i}>{f}</Bullet>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Next Best Action</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.nextBestAction.action}</div>
                <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.nextBestAction.why}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Data Quality</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.dataQuality.score}% — {analysis.enhancedPredictions.dataQuality.impactOnConfidence}</div>
                {analysis.enhancedPredictions.dataQuality.missingFields.length > 0 && (
                  <div className="mt-1 text-xs text-danger">Missing: {analysis.enhancedPredictions.dataQuality.missingFields.join(", ")}</div>
                )}
              </div>
            </div>
          </AccordionItem>
        )}

        {analysis.evidence.length > 0 && (
          <AccordionItem title="Evidence" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {analysis.evidence.map((e, i) => (
                <Bullet key={i}>{e}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.riskReasons.length > 0 && (
          <AccordionItem title="Risks" icon={AlertTriangle}>
            <ul className="space-y-1.5">
              {analysis.riskReasons.map((r, i) => (
                <Bullet key={i}>{r}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.opportunityReasons.length > 0 && (
          <AccordionItem title="Opportunities" icon={TrendingUp}>
            <ul className="space-y-1.5">
              {analysis.opportunityReasons.map((o, i) => (
                <Bullet key={i}>{o}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.recommendedActions.length > 0 && (
          <AccordionItem title="Quick Actions" icon={Target}>
            <ActionShortcuts entityType="lead" />
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deal Insights (Progressive Disclosure)                             */
/* ------------------------------------------------------------------ */

function DealInsights({ analysis }: { analysis: DealAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          {analysis.evidenceQuality && evidenceQualityBadge(analysis.evidenceQuality)}
          {healthBadge(analysis.health)}
        </div>
      </div>

      {/* Compact Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {analysis.enhancedPredictions && (
          <>
            <MetricCard
              title="Deal Health"
              value={analysis.enhancedPredictions.dealHealth.score}
              level={analysis.enhancedPredictions.dealHealth.level}
              explanation={analysis.enhancedPredictions.dealHealth.factors.join(". ")}
              onClick={() => {}}
            />
            <MetricCard
              title="Opportunity Score"
              value={analysis.enhancedPredictions.opportunityScore.score}
              level={analysis.enhancedPredictions.opportunityScore.level}
              explanation={analysis.enhancedPredictions.opportunityScore.factors.join(". ")}
              onClick={() => {}}
            />
          </>
        )}
        {analysis.predictions && (
          <>
            <MetricCard
              title="Win Probability"
              value={analysis.predictions.winProbability.value}
              suffix="%"
              confidence={analysis.predictions.winProbability.confidence}
              explanation={analysis.predictions.winProbability.explanation}
              basis={analysis.predictions.winProbability.basis}
              onClick={() => {}}
            />
            <MetricCard
              title="Stagnation Risk"
              value={analysis.predictions.stagnationRisk.value}
              suffix="%"
              confidence={analysis.predictions.stagnationRisk.confidence}
              explanation={analysis.predictions.stagnationRisk.explanation}
              basis={analysis.predictions.stagnationRisk.basis}
              onClick={() => {}}
            />
            <MetricCard
              title="Follow-up Priority"
              value={analysis.predictions.followUpPriority.value}
              suffix="%"
              confidence={analysis.predictions.followUpPriority.confidence}
              explanation={analysis.predictions.followUpPriority.explanation}
              basis={analysis.predictions.followUpPriority.basis}
              onClick={() => {}}
            />
            <MetricCard
              title="Engagement Score"
              value={analysis.predictions.engagementScore.value}
              suffix="%"
              confidence={analysis.predictions.engagementScore.confidence}
              explanation={analysis.predictions.engagementScore.explanation}
              basis={analysis.predictions.engagementScore.basis}
              onClick={() => {}}
            />
          </>
        )}
      </div>

      <Accordion>
        <AccordionItem title="Overview" icon={TrendingUp}>
          <p className="text-xs leading-relaxed text-foreground/80">
            {analysis.overview}
          </p>
        </AccordionItem>

        {analysis.whatChanged && analysis.whatChanged !== "No significant change detected." && (
          <AccordionItem title="What Changed" icon={GitCompare}>
            <p className="text-xs leading-relaxed text-foreground/80">{analysis.whatChanged}</p>
          </AccordionItem>
        )}

        {analysis.behavioralPatterns && analysis.behavioralPatterns.length > 0 && (
          <AccordionItem title="Behavioral Patterns" icon={Activity}>
            <div className="space-y-2">
              {analysis.behavioralPatterns.map((pattern, i) => (
                <div key={i} className={`rounded-lg border p-2 ${
                  pattern.severity === "critical" ? "border-danger/30 bg-danger/5" :
                  pattern.severity === "warning" ? "border-warning/30 bg-warning/5" :
                  "border-border bg-muted/20"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{pattern.title}</span>
                    <Badge variant={pattern.severity === "critical" ? "danger" : pattern.severity === "warning" ? "warning" : "outline"}>
                      {pattern.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence: {pattern.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.contradictions && analysis.contradictions.length > 0 && (
          <AccordionItem title="Data Consistency Checks" icon={Shield}>
            <div className="space-y-1">
              {analysis.contradictions.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.probabilityPct && analysis.probabilityPct >= 70 && analysis.riskReasons.some(r => r.includes("Probability/Evidence Mismatch")) && (
          <AccordionItem title="Probability / Evidence Mismatch" icon={AlertTriangle}>
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 space-y-1.5">
              <p className="text-xs text-warning font-medium">Stored probability may be overstated</p>
              <p className="text-xs text-muted-foreground">
                CRM shows {analysis.probabilityPct}% win probability, but current evidence suggests otherwise:
              </p>
              <ul className="space-y-1">
                {analysis.riskReasons.filter(r => r.includes("Probability/Evidence Mismatch")).map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-warning">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-warning" />
                    <span>{r.replace(/Probability\/Evidence Mismatch:\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AccordionItem>
        )}

        {analysis.dataQualityWarnings && analysis.dataQualityWarnings.length > 0 && (
          <AccordionItem title="Data Quality Notes" icon={Activity}>
            <div className="space-y-1">
              {analysis.dataQualityWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/30" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.stagesProgression && analysis.stagesProgression.length > 1 && (
          <AccordionItem title="Stage Progression" icon={GitCompare}>
            <div className="flex flex-wrap gap-1.5 items-center">
              {analysis.stagesProgression.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs rounded-md border border-border bg-muted/20 px-2 py-0.5">{s.stage}</span>
                  {s.durationDays !== null && (
                    <span className="text-xs text-muted-foreground">{s.durationDays}d</span>
                  )}
                  {i < analysis.stagesProgression.length - 1 && (
                    <ArrowRight className="size-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {analysis.enhancedPredictions && (
          <AccordionItem title="Advanced Predictive Intelligence" icon={Brain}>
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Next Best Action</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.nextBestAction.action}</div>
                <div className="mt-1 text-xs text-foreground/70">{analysis.enhancedPredictions.nextBestAction.why}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground">Data Quality</div>
                <div className="mt-1 text-sm font-medium">{analysis.enhancedPredictions.dataQuality.score}% — {analysis.enhancedPredictions.dataQuality.impactOnConfidence}</div>
                {analysis.enhancedPredictions.dataQuality.missingFields.length > 0 && (
                  <div className="mt-1 text-xs text-danger">Missing: {analysis.enhancedPredictions.dataQuality.missingFields.join(", ")}</div>
                )}
              </div>
            </div>
          </AccordionItem>
        )}

        {analysis.evidence.length > 0 && (
          <AccordionItem title="Evidence" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {analysis.evidence.map((e, i) => (
                <Bullet key={i}>{e}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.riskReasons.length > 0 && (
          <AccordionItem title="Risks" icon={AlertTriangle}>
            <ul className="space-y-1.5">
              {analysis.riskReasons.map((r, i) => (
                <Bullet key={i}>{r}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.opportunityReasons.length > 0 && (
          <AccordionItem title="Opportunities" icon={Lightbulb}>
            <ul className="space-y-1.5">
              {analysis.opportunityReasons.map((o, i) => (
                <Bullet key={i}>{o}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.recommendedActions.length > 0 && (
          <AccordionItem title="Quick Actions" icon={Target}>
            <ActionShortcuts entityType="deal" />
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Task Insights (Progressive Disclosure)                             */
/* ------------------------------------------------------------------ */

function TaskInsights({ analysis }: { analysis: TaskAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          {analysis.evidenceQuality && evidenceQualityBadge(analysis.evidenceQuality)}
          {riskBadge(analysis.priority)}
        </div>
      </div>

      <Accordion>
        <AccordionItem title="Overview" icon={Target}>
          <p className="text-xs leading-relaxed text-foreground/80">
            {analysis.overview}
          </p>
        </AccordionItem>

        {analysis.evidence.length > 0 && (
          <AccordionItem title="Evidence" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {analysis.evidence.map((e, i) => (
                <Bullet key={i}>{e}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.relatedActivitiesSummary.length > 0 && (
          <AccordionItem title="Related Activities" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {analysis.relatedActivitiesSummary.slice(0, 3).map((a, i) => (
                <Bullet key={i}>{a}</Bullet>
              ))}
            </ul>
          </AccordionItem>
        )}

        {analysis.recommendedNextSteps.length > 0 && (
          <AccordionItem title="Quick Actions" icon={Target}>
            <ActionShortcuts entityType="task" />
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

type RecordAiInsightsProps =
  | { type: "customer"; analysis: CustomerAnalysis | null }
  | { type: "lead"; analysis: LeadAnalysis | null }
  | { type: "deal"; analysis: DealAnalysis | null }
  | { type: "task"; analysis: TaskAnalysis | null };

export function RecordAiInsights(props: RecordAiInsightsProps) {
  if (!props.analysis) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="relative space-y-4 p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight">AI Insights</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Insufficient data to generate analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  switch (props.type) {
    case "customer":
      return <CustomerInsights analysis={props.analysis} />;
    case "lead":
      return <LeadInsights analysis={props.analysis} />;
    case "deal":
      return <DealInsights analysis={props.analysis} />;
    case "task":
      return <TaskInsights analysis={props.analysis} />;
    default:
      return null;
  }
}

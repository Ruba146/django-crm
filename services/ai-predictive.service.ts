import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { predictDeal, predictLead, predictCustomer } from "./ai-prediction.service";
import {
  generateDealActionRecommendation,
  generateLeadActionRecommendation,
  generateCustomerActionRecommendation,
  generateTaskActionRecommendation,
} from "@/services/ai-action-recommendation.service";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DealHealthScore {
  score: number;
  level: "healthy" | "at-risk" | "stalled" | "critical";
  factors: string[];
}

export interface RiskScore {
  overall: number;
  level: "low" | "medium" | "high" | "critical";
  categories: {
    inactivity: number;
    engagementDecline: number;
    overdueTasks: number;
    closeDatePressure: number;
    stageStagnation: number;
    lowHistoricalConversion: number;
    ownerWorkload: number;
    missingInfo: number;
    unusualBehavior: number;
  };
  primaryRisk: string;
  secondaryRisks: string[];
}

export interface OpportunityScore {
  score: number;
  level: "low" | "medium" | "high";
  factors: string[];
  evidence: string[];
}

export interface HistoricalBenchmark {
  comparableDeals: number;
  won: number;
  lost: number;
  stalled: number;
  historicalWinRate: number;
  avgTimeToClose: number | null;
  avgStageDuration: number | null;
  avgActivityFrequency: number | null;
  confidence: "high" | "medium" | "low";
}

export interface SimilarDeal {
  id: string;
  name: string;
  stage: string;
  outcome: string | null;
  expectedValueMinor: number | null;
  daysToClose: number | null;
  similarityScore: number;
}

export interface TemporalAnalysis {
  engagementTrend: "increasing" | "stable" | "decreasing" | "none";
  activityTrend: "increasing" | "stable" | "decreasing" | "none";
  responseTrend: "increasing" | "stable" | "decreasing" | "none";
  taskCompletionTrend: "increasing" | "stable" | "decreasing" | "none";
  inactivityPeriods: Array<{ start: string; end: string; days: number }>;
  acceleration: "accelerating" | "stable" | "decelerating" | "unknown";
  evidence: string[];
}

export interface TurningPoint {
  date: string;
  type: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export interface Anomaly {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
  evidence: string[];
}

export interface NextBestAction {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  why: string;
  expectedImpact: string[];
  deadline: string | null;
  urgency?: "immediate" | "within_48h" | "within_week" | "routine";
  relatedRecord?: {
    type: "deal" | "lead" | "customer" | "task";
    id: string;
    name: string;
  } | null;
  evidence?: string[];
  confidence?: "high" | "medium" | "low";
  negativeConsequence?: string;
}

export interface WhatIfScenario {
  scenario: string;
  estimatedProbability: number | null;
  estimatedRisk: number | null;
  reasoning: string;
  confidence: "high" | "medium" | "low";
}

export interface DataQualityAssessment {
  score: number;
  missingFields: string[];
  completeness: Record<string, boolean>;
  impactOnConfidence: string;
}

export interface ExplainablePrediction {
  positiveFactors: string[];
  negativeFactors: string[];
  neutralFactors: string[];
  historicalEvidence: string[];
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}

export interface EnhancedDealPredictions {
  // Existing
  winProbability: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  stagnationRisk: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  // New Phase 17
  aiWinProbability: number;
  aiLossProbability: number;
  aiStallProbability: number;
  overallConfidence: "high" | "medium" | "low";
  expectedCloseWindow: string | null;
  dealHealth: DealHealthScore;
  riskScore: RiskScore;
  opportunityScore: OpportunityScore;
  historicalBenchmark: HistoricalBenchmark;
  similarDeals: SimilarDeal[];
  temporalAnalysis: TemporalAnalysis;
  turningPoints: TurningPoint[];
  anomalies: Anomaly[];
  nextBestAction: NextBestAction;
  whatIfScenarios: WhatIfScenario[];
  dataQuality: DataQualityAssessment;
  explainability: ExplainablePrediction;
}

export interface EnhancedCustomerPredictions {
  churnRisk: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  relationshipHealth: { score: number; level: string; factors: string[] };
  opportunityScore: OpportunityScore;
  nextBestAction: NextBestAction;
  dataQuality: DataQualityAssessment;
}

export interface EnhancedLeadPredictions {
  conversionProbability: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  leadHealth: { score: number; level: string; factors: string[] };
  opportunityScore: OpportunityScore;
  nextBestAction: NextBestAction;
  dataQuality: DataQualityAssessment;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)));
}

function safeGet<T>(query: () => T, fallback: T): T {
  try { return query(); } catch { return fallback; }
}

function safeAll<T>(query: () => T[]): T[] {
  try { return query(); } catch { return []; }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toScoreLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function toHealthLevel(score: number): "healthy" | "at-risk" | "stalled" | "critical" {
  if (score >= 70) return "healthy";
  if (score >= 50) return "at-risk";
  if (score >= 30) return "stalled";
  return "critical";
}

/* ------------------------------------------------------------------ */
/* Historical Benchmarking                                             */
/* ------------------------------------------------------------------ */

export function getHistoricalBenchmark(stageId: string | null, expectedValueMinor: number | null): HistoricalBenchmark {
  const db = getDb();
  if (!stageId) {
    return {
      comparableDeals: 0,
      won: 0,
      lost: 0,
      stalled: 0,
      historicalWinRate: 0,
      avgTimeToClose: null,
      avgStageDuration: null,
      avgActivityFrequency: null,
      confidence: "low",
    };
  }

  const valueRangeLow = expectedValueMinor ? Math.max(0, expectedValueMinor - (expectedValueMinor * 0.3)) : 0;
  const valueRangeHigh = expectedValueMinor ? expectedValueMinor + (expectedValueMinor * 0.3) : 999999999;

  const comparable = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.expected_value_minor, s.terminal_type,
                  CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS stage_days,
                  (SELECT COUNT(*) FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = d.id) AS activity_count,
                  CASE WHEN d.actual_close_date IS NOT NULL THEN CAST(julianday(d.actual_close_date) - julianday(d.created_at) AS INTEGER) ELSE NULL END AS days_to_close
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND d.stage_id = ?
             AND (d.expected_value_minor BETWEEN ? AND ? OR d.expected_value_minor IS NULL)
           LIMIT 50`
        )
        .all(stageId, valueRangeLow, valueRangeHigh) as Array<{
          id: string;
          expected_value_minor: number | null;
          terminal_type: string | null;
          stage_days: number | null;
          activity_count: number | null;
          days_to_close: number | null;
        }>
  );

  const won = comparable.filter((c) => c.terminal_type === "won").length;
  const lost = comparable.filter((c) => c.terminal_type === "lost").length;
  const stalled = comparable.filter((c) => c.stage_days !== null && c.stage_days > 30).length;
  const total = comparable.length;

  const avgTimeToClose = total > 0
    ? Math.round(comparable.filter((c) => c.days_to_close !== null).reduce((sum, c) => sum + (c.days_to_close ?? 0), 0) / total)
    : null;

  const avgStageDuration = total > 0
    ? Math.round(comparable.filter((c) => c.stage_days !== null).reduce((sum, c) => sum + (c.stage_days ?? 0), 0) / total)
    : null;

  const avgActivityFreq = total > 0
    ? Math.round(comparable.filter((c) => c.activity_count !== null).reduce((sum, c) => sum + (c.activity_count ?? 0), 0) / total)
    : null;

  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  const confidence = total >= 10 ? "high" : total >= 5 ? "medium" : "low";

  return {
    comparableDeals: total,
    won,
    lost,
    stalled,
    historicalWinRate: winRate,
    avgTimeToClose,
    avgStageDuration,
    avgActivityFrequency: avgActivityFreq,
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Similar Deals                                                       */
/* ------------------------------------------------------------------ */

export function findSimilarDeals(dealId: string, limit = 10): SimilarDeal[] {
  const db = getDb();
  const deal = safeGet(
    () =>
      db
        .prepare(
          `SELECT stage_id, expected_value_minor, establishment_id FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`
        )
        .get(dealId) as { stage_id: string | null; expected_value_minor: number | null; establishment_id: string | null } | undefined,
    undefined
  );

  if (!deal || !deal.stage_id) return [];

  const valueRangeLow = deal.expected_value_minor ? Math.max(0, deal.expected_value_minor - (deal.expected_value_minor * 0.4)) : 0;
  const valueRangeHigh = deal.expected_value_minor ? deal.expected_value_minor + (deal.expected_value_minor * 0.4) : 999999999;

  const similar = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, s.label AS stage, s.terminal_type AS outcome, d.expected_value_minor,
                  CASE WHEN d.actual_close_date IS NOT NULL THEN CAST(julianday(d.actual_close_date) - julianday(d.created_at) AS INTEGER) ELSE NULL END AS days_to_close
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND d.id != ? AND d.stage_id = ?
             AND (d.expected_value_minor BETWEEN ? AND ? OR d.expected_value_minor IS NULL)
           ORDER BY 
             CASE 
               WHEN d.establishment_id = ? THEN 1
               WHEN d.lead_id IN (SELECT lead_id FROM ${TABLES.deals} WHERE id = ?) THEN 2
               ELSE 3
             END
           LIMIT ?`
        )
        .all(dealId, deal.stage_id, valueRangeLow, valueRangeHigh, deal.establishment_id || "", dealId, limit) as Array<{
          id: string;
          name: string | null;
          stage: string | null;
          outcome: string | null;
          expected_value_minor: number | null;
          days_to_close: number | null;
        }>
  );

  return similar.map((s) => ({
    id: s.id,
    name: s.name || "Unknown",
    stage: s.stage || "Unknown",
    outcome: s.outcome,
    expectedValueMinor: s.expected_value_minor,
    daysToClose: s.days_to_close,
    similarityScore: s.outcome === "won" ? 90 : s.outcome === "lost" ? 70 : 80,
  }));
}

/* ------------------------------------------------------------------ */
/* Temporal Analysis                                                   */
/* ------------------------------------------------------------------ */

export function analyzeTemporalBehavior(entityType: "deal" | "lead" | "customer", entityId: string): TemporalAnalysis {
  const db = getDb();

  const activities = safeAll(
    () =>
      db
        .prepare(
          `SELECT occurred_at FROM ${TABLES.activities} WHERE entity_type = ? AND entity_id = ? ORDER BY occurred_at DESC LIMIT 20`
        )
        .all(entityType, entityId) as Array<{ occurred_at: string }>
  );

  const recentCount = activities.filter((a) => {
    const d = new Date(a.occurred_at);
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  const olderCount = activities.filter((a) => {
    const d = new Date(a.occurred_at);
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 7 && diff <= 14;
  }).length;

  let activityTrend: TemporalAnalysis["activityTrend"] = "none";
  if (recentCount === 0 && activities.length > 0) activityTrend = "decreasing";
  else if (recentCount > olderCount) activityTrend = "increasing";
  else if (recentCount < olderCount && recentCount > 0) activityTrend = "decreasing";
  else if (recentCount > 0 && olderCount > 0) activityTrend = "stable";

  const inactivityPeriods: TemporalAnalysis["inactivityPeriods"] = [];
  if (activities.length >= 2) {
    let periodStart: string | null = null;
    for (let i = 0; i < activities.length - 1; i++) {
      const current = new Date(activities[i].occurred_at);
      const next = new Date(activities[i + 1].occurred_at);
      const gapDays = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
      if (gapDays >= 14) {
        if (!periodStart) periodStart = activities[i + 1].occurred_at.split("T")[0];
        inactivityPeriods.push({
          start: activities[i + 1].occurred_at.split("T")[0],
          end: activities[i].occurred_at.split("T")[0],
          days: gapDays,
        });
      }
    }
  }

  const acceleration = activityTrend === "increasing" ? "accelerating" : activityTrend === "decreasing" ? "decelerating" : "stable";

  const evidence: string[] = [];
  if (activities.length > 0) {
    evidence.push(`${activities.length} activities recorded in recent history`);
  }
  if (recentCount > 0) {
    evidence.push(`${recentCount} activities in the last 7 days`);
  }
  if (inactivityPeriods.length > 0) {
    evidence.push(`${inactivityPeriods.length} inactivity period(s) of 14+ days detected`);
  }

  return {
    engagementTrend: activityTrend,
    activityTrend,
    responseTrend: activityTrend,
    taskCompletionTrend: "none",
    inactivityPeriods: inactivityPeriods.slice(0, 5),
    acceleration,
    evidence,
  };
}

/* ------------------------------------------------------------------ */
/* Turning Points                                                      */
/* ------------------------------------------------------------------ */

export function detectTurningPoints(entityType: "deal" | "lead" | "customer", entityId: string): TurningPoint[] {
  const db = getDb();
  const points: TurningPoint[] = [];

  const deal = entityType === "deal"
    ? safeGet(() => db.prepare(`SELECT created_at, updated_at, stage_id FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(entityId) as Record<string, unknown> | undefined, undefined)
    : null;

  if (deal?.created_at) {
    points.push({
      date: (deal.created_at as string).split("T")[0],
      type: "deal_created",
      description: "Deal was created",
      impact: "neutral",
    });
  }

  const activities = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.occurred_at, a.body, at.label AS label
           FROM ${TABLES.activities} a
           LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
           WHERE a.entity_type = ? AND a.entity_id = ?
           ORDER BY a.occurred_at ASC`
        )
        .all(entityType, entityId) as Array<{ occurred_at: string; body: string | null; label: string | null }>
  );

  for (const act of activities.slice(0, 10)) {
    const label = act.label?.toLowerCase() || "";
    if (label.includes("meeting") || label.includes("demo")) {
      points.push({
        date: act.occurred_at.split("T")[0],
        type: "meeting",
        description: act.body || "Meeting/demo occurred",
        impact: "positive",
      });
    } else if (label.includes("call") || label.includes("call")) {
      points.push({
        date: act.occurred_at.split("T")[0],
        type: "call",
        description: act.body || "Call occurred",
        impact: "positive",
      });
    } else if (label.includes("proposal") || label.includes("sent")) {
      points.push({
        date: act.occurred_at.split("T")[0],
        type: "proposal",
        description: act.body || "Proposal sent",
        impact: "positive",
      });
    }
  }

  const tasks = safeAll(
    () =>
      db
        .prepare(
          `SELECT created_at, completed_at, title FROM ${TABLES.tasks} WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC LIMIT 10`
        )
        .all(entityType, entityId) as Array<{ created_at: string; completed_at: string | null; title: string }>
  );

  for (const task of tasks) {
    if (task.completed_at) {
      points.push({
        date: task.completed_at.split("T")[0],
        type: "task_completed",
        description: `Task completed: ${task.title}`,
        impact: "positive",
      });
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
}

/* ------------------------------------------------------------------ */
/* Anomaly Detection                                                   */
/* ------------------------------------------------------------------ */

export function detectAnomalies(entityType: "deal" | "lead" | "customer", entityId: string): Anomaly[] {
  const db = getDb();
  const anomalies: Anomaly[] = [];

  if (entityType === "deal") {
    const deal = safeGet(
      () => db.prepare(`SELECT * FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(entityId) as Record<string, unknown> | undefined,
      undefined
    );
    if (!deal) return [];

    const now = new Date().toISOString().split("T")[0];
    const lastActivity = safeGet(
      () => db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(entityId) as { last: string | null },
      { last: null }
    ).last;

    const daysSinceActivity = lastActivity ? daysBetween(lastActivity, now) : null;
    const stageId = deal.stage_id as string | null;
    const stage = safeGet(
      () => db.prepare(`SELECT label, sort_order FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(stageId) as { label: string; sort_order: number } | undefined,
      undefined
    );

    const stageDuration = (deal.updated_at as string | null) ? daysBetween(deal.updated_at as string, now) : null;

    if (stage && stageDuration && stageDuration > 30) {
      anomalies.push({
        type: "long_stage_duration",
        description: `Deal has been in ${stage.label} stage for ${stageDuration} days, which is unusually long.`,
        severity: "high",
        evidence: [`Stage: ${stage.label}`, `Duration: ${stageDuration} days`],
      });
    }

    if (daysSinceActivity && daysSinceActivity > 21) {
      anomalies.push({
        type: "inactivity",
        description: `No activity recorded for ${daysSinceActivity} days.`,
        severity: daysSinceActivity > 30 ? "high" : "medium",
        evidence: [`Last activity: ${lastActivity}`, `Days since: ${daysSinceActivity}`],
      });
    }

    const overdueTasks = safeGet(
      () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`).get(entityId) as { c: number },
      { c: 0 }
    ).c;

    if (overdueTasks > 0) {
      anomalies.push({
        type: "overdue_tasks",
        description: `${overdueTasks} task(s) are overdue.`,
        severity: "medium",
        evidence: [`Overdue tasks: ${overdueTasks}`],
      });
    }
  }

  return anomalies;
}

/* ------------------------------------------------------------------ */
/* Data Quality Assessment                                             */
/* ------------------------------------------------------------------ */

export function assessDataQuality(entityType: "deal" | "lead" | "customer" | "task" | "activity", entityId: string): DataQualityAssessment {
  const db = getDb();
  const missingFields: string[] = [];
  const completeness: Record<string, boolean> = {};

  if (entityType === "deal") {
    const deal = safeGet(
      () => db.prepare(`SELECT * FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(entityId) as Record<string, unknown> | undefined,
      undefined
    );
    if (!deal) {
      return { score: 0, missingFields: ["record_not_found"], completeness: {}, impactOnConfidence: "Record not found." };
    }

    completeness.name = !!deal.name;
    completeness.stage = !!deal.stage_id;
    completeness.expectedValue = !!deal.expected_value_minor;
    completeness.targetCloseDate = !!deal.target_close_date;
    completeness.probability = deal.probability_pct !== null;
    completeness.owner = !!deal.owner_id;

    if (!deal.name) missingFields.push("name");
    if (!deal.stage_id) missingFields.push("stage");
    if (!deal.expected_value_minor) missingFields.push("expected_value");
    if (!deal.target_close_date) missingFields.push("target_close_date");
    if (deal.probability_pct === null) missingFields.push("probability");
    if (!deal.owner_id) missingFields.push("owner");

    const activityCount = safeGet(
      () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(entityId) as { c: number },
      { c: 0 }
    ).c;
    completeness.activities = activityCount > 0;

    const taskCount = safeGet(
      () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ?`).get(entityId) as { c: number },
      { c: 0 }
    ).c;
    completeness.tasks = taskCount > 0;
  }

  const totalFields = Object.keys(completeness).length;
  const filledFields = Object.values(completeness).filter(Boolean).length;
  const score = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  const impact = score >= 80 ? "Confidence is high." : score >= 50 ? "Confidence is moderate due to missing data." : "Confidence is low because key information is missing.";

  return { score, missingFields, completeness, impactOnConfidence: impact };
}

/* ------------------------------------------------------------------ */
/* Next Best Action                                                    */
/* ------------------------------------------------------------------ */

export function recommendNextBestAction(entityType: "deal" | "lead" | "customer" | "task", entityId: string): NextBestAction {
  let action: import("@/services/ai-action-recommendation.service").RecommendedAction | null = null;
  try {
    if (entityType === "deal") {
      action = generateDealActionRecommendation(entityId);
    } else if (entityType === "lead") {
      action = generateLeadActionRecommendation(entityId);
    } else if (entityType === "customer") {
      action = generateCustomerActionRecommendation(entityId);
    } else if (entityType === "task") {
      action = generateTaskActionRecommendation(entityId);
    }
  } catch {
    // fallback to basic logic below
  }

  if (action) {
    return {
      action: action.action,
      priority: action.priority,
      why: action.reason,
      expectedImpact: action.expectedImpact,
      deadline: action.urgency === "immediate" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : action.urgency === "within_48h" ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : null,
      urgency: action.urgency,
      relatedRecord: action.relatedRecord || undefined,
      evidence: action.evidence,
      confidence: action.confidence,
      negativeConsequence: action.negativeConsequence,
    };
  }

  const db = getDb();
  if (entityType === "deal") {
    const deal = safeGet(
      () => db.prepare(`SELECT d.*, ps.label AS stage_label FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id WHERE d.id = ? AND d.deleted_at IS NULL LIMIT 1`).get(entityId) as Record<string, unknown> | undefined,
      undefined
    );
    if (!deal) return { action: "Record not found", priority: "low", why: "", expectedImpact: [], deadline: null };

    const now = new Date().toISOString().split("T")[0];
    const daysSinceActivity = (deal.updated_at as string | null) ? daysBetween(deal.updated_at as string, now) : null;
    const overdueTasks = safeGet(
      () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`).get(entityId) as { c: number },
      { c: 0 }
    ).c;

    if (overdueTasks > 0) {
      return {
        action: `Complete ${overdueTasks} overdue follow-up task(s)`,
        priority: "high",
        why: `Overdue tasks are blocking momentum on this ${deal.stage_label || "deal"}.`,
        expectedImpact: ["Restore engagement", "Reduce stall risk", "Maintain close probability"],
        deadline: null,
      };
    }

    if (daysSinceActivity && daysSinceActivity > 14) {
      return {
        action: "Schedule a follow-up call or meeting within 48 hours",
        priority: "high",
        why: `No activity for ${daysSinceActivity} days. Re-engagement is critical to prevent further stagnation.`,
        expectedImpact: ["Re-engage the customer", "Gather updated requirements", "Reduce stall risk"],
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
    }

    if (deal.stage_label === "Qualified") {
      return {
        action: "Schedule a demo or needs-assessment meeting",
        priority: "medium",
        why: "The deal is qualified but needs deeper engagement to advance.",
        expectedImpact: ["Advance to Proposal stage", "Strengthen customer relationship"],
        deadline: null,
      };
    }

    if (deal.stage_label === "Proposal") {
      return {
        action: "Follow up on the proposal and address objections",
        priority: "medium",
        why: "Proposal is sent but no confirmation of next steps.",
        expectedImpact: ["Move to Negotiation", "Close the deal"],
        deadline: null,
      };
    }

    return {
      action: "Continue current engagement and monitor for signals",
      priority: "low",
      why: "Deal appears healthy with no urgent action required.",
      expectedImpact: ["Maintain relationship", "Prepare for close"],
      deadline: null,
    };
  }

  if (entityType === "lead") {
    return {
      action: "Contact the lead to assess conversion readiness",
      priority: "medium",
      why: "Regular follow-up improves lead conversion rates.",
      expectedImpact: ["Increase engagement", "Move lead to next stage"],
      deadline: null,
    };
  }

  return {
    action: "Review customer relationship and identify upsell opportunities",
    priority: "medium",
    why: "Maintaining customer relationships drives repeat business.",
    expectedImpact: ["Increase retention", "Identify new opportunities"],
    deadline: null,
  };
}

/* ------------------------------------------------------------------ */
/* What-If Analysis                                                    */
/* ------------------------------------------------------------------ */

export function runWhatIfAnalysis(entityType: "deal" | "lead" | "customer", entityId: string): WhatIfScenario[] {
  const db = getDb();
  const scenarios: WhatIfScenario[] = [];

  if (entityType === "deal") {
    const deal = safeGet(
      () => db.prepare(`SELECT updated_at FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(entityId) as { updated_at: string | null } | undefined,
      undefined
    );
    if (!deal) return [];

    const now = new Date().toISOString().split("T")[0];
    const daysSinceUpdate = deal.updated_at ? daysBetween(deal.updated_at, now) : null;

    scenarios.push({
      scenario: "No action taken for 14 days",
      estimatedProbability: daysSinceUpdate && daysSinceUpdate > 7 ? 45 : null,
      estimatedRisk: daysSinceUpdate && daysSinceUpdate > 7 ? 70 : null,
      reasoning: daysSinceUpdate && daysSinceUpdate > 7
        ? "Historical deals with 14+ days of inactivity show declining conversion rates."
        : "Insufficient inactivity data to estimate impact.",
      confidence: daysSinceUpdate && daysSinceUpdate > 7 ? "medium" : "low",
    });

    scenarios.push({
      scenario: "Follow-up completed within 48 hours",
      estimatedProbability: 65,
      estimatedRisk: 30,
      reasoning: "Timely follow-up generally improves engagement and close rates based on CRM patterns.",
      confidence: "medium",
    });

    scenarios.push({
      scenario: "Deal moves to next stage",
      estimatedProbability: 70,
      estimatedRisk: 20,
      reasoning: "Advancing stages is associated with higher close rates when supported by recent activity.",
      confidence: "medium",
    });
  }

  return scenarios;
}

/* ------------------------------------------------------------------ */
/* Enhanced Deal Predictions                                           */
/* ------------------------------------------------------------------ */

export function predictDealEnhanced(dealId: string): EnhancedDealPredictions | null {
  const db = getDb();
  const deal = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.*, ps.label AS stage_label, ps.is_terminal, ps.terminal_type, ps.sort_order
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
           WHERE d.id = ? AND d.deleted_at IS NULL
           LIMIT 1`
        )
        .get(dealId) as Record<string, unknown>,
    null
  );

  if (!deal) return null;

  const basePredictions = predictDeal(dealId);
  if (!basePredictions) return null;

  const stageId = deal.stage_id as string | null;
  const expectedValueMinor = (deal.expected_value_minor as number | null) ?? null;

  // AI probabilities (separate from CRM)
  const aiWinProbability = basePredictions.winProbability.value;
  const aiLossProbability = clamp(100 - aiWinProbability - basePredictions.stagnationRisk.value, 0, 100);
  const aiStallProbability = basePredictions.stagnationRisk.value;
  const overallConfidence = basePredictions.winProbability.confidence;

  // Expected close window
  const targetClose = deal.target_close_date as string | null;
  let expectedCloseWindow: string | null = null;
  if (targetClose && new Date(targetClose) > new Date()) {
    expectedCloseWindow = `Target: ${targetClose}`;
  } else if (!targetClose) {
    const benchmark = getHistoricalBenchmark(stageId, expectedValueMinor);
    if (benchmark.avgTimeToClose) {
      const created = (deal.created_at as string | null)?.split("T")[0];
      if (created) {
        const estimated = new Date(created);
        estimated.setDate(estimated.getDate() + benchmark.avgTimeToClose);
        expectedCloseWindow = `Estimated: ${estimated.toISOString().split("T")[0]}`;
      }
    }
  }

  // Deal Health Score
  const healthFactors: string[] = [];
  let healthScore = 50;
  if (basePredictions.engagementScore.value >= 70) { healthScore += 20; healthFactors.push("Strong engagement"); }
  else if (basePredictions.engagementScore.value < 40) { healthScore -= 20; healthFactors.push("Weak engagement"); }

  if (basePredictions.stagnationRisk.value < 30) { healthScore += 15; healthFactors.push("Low stagnation risk"); }
  else if (basePredictions.stagnationRisk.value > 60) { healthScore -= 20; healthFactors.push("High stagnation risk"); }

  const isStalled = basePredictions.stagnationRisk.value >= 60;
  if (!isStalled) { healthScore += 10; healthFactors.push("Deal is progressing"); }
  else { healthScore -= 15; healthFactors.push("Deal is stalled"); }

  const dealHealth: DealHealthScore = {
    score: clamp(healthScore, 0, 100),
    level: toHealthLevel(healthScore),
    factors: healthFactors,
  };

  // Risk Score
  const riskCategories: RiskScore["categories"] = {
    inactivity: 0,
    engagementDecline: 0,
    overdueTasks: 0,
    closeDatePressure: 0,
    stageStagnation: 0,
    lowHistoricalConversion: 0,
    ownerWorkload: 0,
    missingInfo: 0,
    unusualBehavior: 0,
  };
  const riskReasons: string[] = [];

  const now = new Date().toISOString().split("T")[0];
  const lastActivity = safeGet(
    () => db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(dealId) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;
  if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    riskCategories.inactivity = clamp(daysSinceLastActivity * 2, 0, 100);
    riskReasons.push(`${daysSinceLastActivity} days without activity`);
  }
  if (basePredictions.engagementScore.value < 40) {
    riskCategories.engagementDecline = 40;
    riskReasons.push("Engagement score is low");
  }
  const overdueTasks = basePredictions.followUpPriority.basis.filter((b) => b.includes("overdue")).length;
  if (overdueTasks > 0) {
    riskCategories.overdueTasks = 30;
    riskReasons.push(`${overdueTasks} overdue task(s)`);
  }
  const isOverdue = targetClose != null && new Date(targetClose) < new Date();
  if (isOverdue) {
    riskCategories.closeDatePressure = 50;
    riskReasons.push("Past target close date");
  }
  const daysInStage = (deal.updated_at as string | null) ? daysBetween(deal.updated_at as string, now) : null;
  if (daysInStage && daysInStage > 30) {
    riskCategories.stageStagnation = 40;
    riskReasons.push(`Deal in stage for ${daysInStage} days`);
  }

  const benchmark = getHistoricalBenchmark(stageId, expectedValueMinor);
  if (benchmark.historicalWinRate < 30 && benchmark.comparableDeals >= 5) {
    riskCategories.lowHistoricalConversion = 35;
    riskReasons.push(`Low historical conversion (${benchmark.historicalWinRate}%)`);
  }

  const missingCount = Object.values(assessDataQuality("deal", dealId).completeness).filter(Boolean).length;
  const totalExpected = 7;
  if (missingCount < totalExpected) {
    riskCategories.missingInfo = clamp((1 - missingCount / totalExpected) * 50, 0, 50);
    riskReasons.push("Missing CRM information");
  }

  const riskScore = clamp(
    Object.values(riskCategories).reduce((sum, v) => sum + v, 0) / Object.values(riskCategories).length,
    0,
    100
  );

  const riskScoreResult: RiskScore = {
    overall: Math.round(riskScore),
    level: toScoreLevel(riskScore),
    categories: riskCategories,
    primaryRisk: riskReasons[0] || "No significant risks detected",
    secondaryRisks: riskReasons.slice(1),
  };

  // Opportunity Score
  const oppFactors: string[] = [];
  const oppEvidence: string[] = [];
  let oppScore = 30;

  if (basePredictions.winProbability.value >= 60) {
    oppScore += 20;
    oppFactors.push("High win probability");
    oppEvidence.push(`AI win probability: ${basePredictions.winProbability.value}%`);
  }
  if (basePredictions.engagementScore.value >= 60) {
    oppScore += 15;
    oppFactors.push("Strong engagement");
    oppEvidence.push("Recent activity indicates active interest");
  }
  if (expectedValueMinor && expectedValueMinor > 500000) {
    oppScore += 15;
    oppFactors.push("High-value opportunity");
    oppEvidence.push(`Expected value: ${(expectedValueMinor / 100).toFixed(2)} SAR`);
  }
  if (benchmark.historicalWinRate >= 50) {
    oppScore += 10;
    oppFactors.push("Comparable deals have strong win rate");
    oppEvidence.push(`Historical win rate: ${benchmark.historicalWinRate}%`);
  }
  if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
    oppScore += 10;
    oppFactors.push("Recent activity");
    oppEvidence.push(`Last activity ${daysSinceLastActivity} days ago`);
  }

  const opportunityScoreResult: OpportunityScore = {
    score: clamp(oppScore, 0, 100),
    level: toScoreLevel(oppScore) === "low" ? "low" : toScoreLevel(oppScore) === "critical" ? "high" : toScoreLevel(oppScore) === "high" ? "high" : "medium",
    factors: oppFactors,
    evidence: oppEvidence,
  };

  // Historical benchmark
  const historicalBenchmark = getHistoricalBenchmark(stageId, expectedValueMinor);

  // Similar deals
  const similarDeals = findSimilarDeals(dealId);

  // Temporal analysis
  const temporalAnalysis = analyzeTemporalBehavior("deal", dealId);

  // Turning points
  const turningPoints = detectTurningPoints("deal", dealId);

  // Anomalies
  const anomalies = detectAnomalies("deal", dealId);

  // Next best action
  const nextBestAction = recommendNextBestAction("deal", dealId);

  // What-if scenarios
  const whatIfScenarios = runWhatIfAnalysis("deal", dealId);

  // Data quality
  const dataQuality = assessDataQuality("deal", dealId);

  // Explainability
  const explainability: ExplainablePrediction = {
    positiveFactors: basePredictions.winProbability.basis.filter((b) => !b.includes("No activity") && !b.includes("decreasing") && !b.includes("stalled") && !b.includes("Past target") && !b.includes("overdue")),
    negativeFactors: basePredictions.winProbability.basis.filter((b) => b.includes("No activity") || b.includes("decreasing") || b.includes("stalled") || b.includes("Past target") || b.includes("overdue")),
    neutralFactors: [],
    historicalEvidence: [`${benchmark.comparableDeals} comparable historical deals`, `Historical win rate: ${benchmark.historicalWinRate}%`],
    confidence: overallConfidence,
    confidenceReason: overallConfidence === "high"
      ? `Based on ${basePredictions.winProbability.basis.length} strong signals and ${benchmark.comparableDeals} comparable deals.`
      : overallConfidence === "medium"
        ? `Based on ${basePredictions.winProbability.basis.length} signals and ${benchmark.comparableDeals} comparable deals.`
        : `Limited data available. Only ${basePredictions.winProbability.basis.length} signals and ${benchmark.comparableDeals} comparable deals.`,
  };

  return {
    ...basePredictions,
    aiWinProbability,
    aiLossProbability,
    aiStallProbability,
    overallConfidence,
    expectedCloseWindow,
    dealHealth: dealHealth,
    riskScore: riskScoreResult,
    opportunityScore: opportunityScoreResult,
    historicalBenchmark,
    similarDeals,
    temporalAnalysis,
    turningPoints,
    anomalies,
    nextBestAction,
    whatIfScenarios,
    dataQuality,
    explainability,
  };
}

/* ------------------------------------------------------------------ */
/* Enhanced Customer Predictions                                       */
/* ------------------------------------------------------------------ */

export function predictCustomerEnhanced(customerId: string): EnhancedCustomerPredictions | null {
  const basePredictions = predictCustomer(customerId);
  if (!basePredictions) return null;

  const relationshipHealth = {
    score: clamp(basePredictions.engagementScore.value + (basePredictions.churnRisk.value < 30 ? 20 : -10), 0, 100),
    level: basePredictions.churnRisk.value < 30 ? "healthy" : basePredictions.churnRisk.value < 60 ? "at-risk" : "critical",
    factors: basePredictions.engagementScore.basis.slice(0, 4),
  };

  const opportunityScoreResult: OpportunityScore = {
    score: clamp(100 - basePredictions.churnRisk.value + basePredictions.engagementScore.value / 2, 0, 100),
    level: basePredictions.churnRisk.value < 30 ? "high" : basePredictions.churnRisk.value < 60 ? "medium" : "low",
    factors: basePredictions.followUpPriority.basis.slice(0, 3),
    evidence: basePredictions.engagementScore.basis.slice(0, 3),
  };

  const nextBestAction = recommendNextBestAction("customer", customerId);
  const dataQuality = assessDataQuality("customer", customerId);

  return {
    ...basePredictions,
    relationshipHealth,
    opportunityScore: opportunityScoreResult,
    nextBestAction,
    dataQuality,
  };
}

/* ------------------------------------------------------------------ */
/* Enhanced Lead Predictions                                           */
/* ------------------------------------------------------------------ */

export function predictLeadEnhanced(leadId: string): EnhancedLeadPredictions | null {
  const basePredictions = predictLead(leadId);
  if (!basePredictions) return null;

  const leadHealth = {
    score: clamp(basePredictions.engagementScore.value + (basePredictions.conversionProbability.value > 50 ? 15 : -10), 0, 100),
    level: basePredictions.engagementScore.value >= 60 ? "healthy" : basePredictions.engagementScore.value >= 40 ? "at-risk" : "cold",
    factors: basePredictions.engagementScore.basis.slice(0, 4),
  };

  const opportunityScoreResult: OpportunityScore = {
    score: clamp(basePredictions.conversionProbability.value + basePredictions.engagementScore.value / 2, 0, 100),
    level: basePredictions.conversionProbability.value >= 60 ? "high" : basePredictions.conversionProbability.value >= 40 ? "medium" : "low",
    factors: basePredictions.conversionProbability.basis.slice(0, 3),
    evidence: basePredictions.followUpPriority.basis.slice(0, 3),
  };

  const nextBestAction = recommendNextBestAction("lead", leadId);
  const dataQuality = assessDataQuality("lead", leadId);

  return {
    ...basePredictions,
    leadHealth,
    opportunityScore: opportunityScoreResult,
    nextBestAction,
    dataQuality,
  };
}

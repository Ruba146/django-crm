import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import {
  getCustomerSummary,
  getLeadSummary,
  getDealSummary,
  getOverdueTasksSummary,
  getOwnerPerformanceSummary,
} from "@/services/ai-context.service";
import { predictDeal, predictLead, predictCustomer, type CustomerPredictions } from "@/services/ai-prediction.service";
import {
  predictDealEnhanced,
  predictCustomerEnhanced,
  predictLeadEnhanced,
} from "@/services/ai-predictive.service";
import {
  detectChanges,
  detectBehavioralPatterns,
  validateContradictions,
  assessRecordDataQuality,
  getStageAwareInsights,
  assessEvidenceQuality,
  analyzeTemporalBehavior,
  getCrossEntityContext,
  type EvidenceQuality,
} from "@/services/ai-intelligence.service";
import {
  generateDealActionRecommendation,
  generateCustomerActionRecommendation,
  generateLeadActionRecommendation,
  generateTaskActionRecommendation,
  type RecommendedAction as StructuredRecommendedAction,
} from "@/services/ai-action-recommendation.service";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CustomerAnalysis {
  id: string;
  name: string;
  ownerName: string | null;
  status: string | null;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenueMinor: number;
  totalActivities: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  avgDealValueMinor: number | null;
  dealValueInPipelineMinor: number | null;
  hasActiveOpportunities: boolean;
  hasOverdueFollowUps: boolean;
  hasStaleDeals: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskReasons: string[];
  opportunityReasons: string[];
  recommendedActions: string[];
  recommendedAction: StructuredRecommendedAction | null;
  evidence: string[];
  overview: string;
  timeline: Array<{
    kind: string;
    occurredAt: string;
    label: string;
    body: string;
    userName: string;
  }>;
  activitiesByType: Record<string, number>;
  predictions?: {
    churnRisk: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  };
  enhancedPredictions?: {
    relationshipHealth: { score: number; level: string; factors: string[] };
    opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
    nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null };
    dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
  };
  whatChanged?: string;
  behavioralPatterns?: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    confidence: string;
  }>;
  evidenceQuality?: "strong" | "medium" | "weak" | "missing";
  contradictions?: string[];
  dataQualityWarnings?: string[];
}

export interface LeadAnalysis {
  id: string;
  fullName: string;
  company: string | null;
  stage: string | null;
  source: string | null;
  ownerName: string | null;
  probabilityPct: number | null;
  created_at: string | null;
  ageDays: number | null;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenueMinor: number;
  totalActivities: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  engagementTrend: "increasing" | "stable" | "decreasing" | "none";
  conversionPotential: "high" | "medium" | "low";
  health: "healthy" | "at-risk" | "stale" | "cold";
  riskReasons: string[];
  opportunityReasons: string[];
  recommendedActions: string[];
  recommendedAction: StructuredRecommendedAction | null;
  evidence: string[];
  overview: string;
  timeline: Array<{
    kind: string;
    occurredAt: string;
    label: string;
    body: string;
    userName: string;
  }>;
  predictions?: {
    conversionProbability: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  };
  enhancedPredictions?: {
    leadHealth: { score: number; level: string; factors: string[] };
    opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
    nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null };
    dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
  };
  whatChanged?: string;
  behavioralPatterns?: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    confidence: string;
  }>;
  evidenceQuality?: "strong" | "medium" | "weak" | "missing";
  contradictions?: string[];
  dataQualityWarnings?: string[];
}

export interface DealAnalysis {
  id: string;
  name: string;
  company: string | null;
  leadName: string | null;
  stage: string | null;
  ownerName: string | null;
  expectedValueMinor: number | null;
  wonValueMinor: number | null;
  probabilityPct: number | null;
  targetCloseDate: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  ageDays: number | null;
  daysSinceLastActivity: number | null;
  daysInCurrentStage: number | null;
  totalActivities: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activityFrequencyPerWeek: number | null;
  engagementTrend: "increasing" | "stable" | "decreasing" | "none";
  isStalled: boolean;
  isOverdue: boolean;
  health: "healthy" | "at-risk" | "stalled" | "critical";
  riskReasons: string[];
  opportunityReasons: string[];
  recommendedActions: string[];
  recommendedAction: StructuredRecommendedAction | null;
  evidence: string[];
  missingInformation: string[];
  overview: string;
  timeline: Array<{
    kind: string;
    occurredAt: string;
    label: string;
    body: string;
    userName: string;
  }>;
  stagesProgression: Array<{
    stage: string;
    changedAt: string | null;
    durationDays: number | null;
  }>;
  stageSummary: {
    totalStageChanges: number;
    currentStageAge: number | null;
    totalDealAge: number | null;
    avgStageDuration: number | null;
    isProlongedInCurrentStage: boolean;
  };
  predictions?: {
    winProbability: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    stagnationRisk: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    followUpPriority: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
    engagementScore: { label: string; value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  };
  enhancedPredictions?: {
    aiWinProbability: number;
    aiLossProbability: number;
    aiStallProbability: number;
    overallConfidence: "high" | "medium" | "low";
    expectedCloseWindow: string | null;
    dealHealth: { score: number; level: string; factors: string[] };
    riskScore: { overall: number; level: string; categories: Record<string, number>; primaryRisk: string; secondaryRisks: string[] };
    opportunityScore: { score: number; level: string; factors: string[]; evidence: string[] };
    historicalBenchmark: { comparableDeals: number; won: number; lost: number; stalled: number; historicalWinRate: number; avgTimeToClose: number | null; avgStageDuration: number | null; avgActivityFrequency: number | null; confidence: string };
    similarDeals: Array<{ id: string; name: string; stage: string; outcome: string | null; expectedValueMinor: number | null; daysToClose: number | null; similarityScore: number }>;
    temporalAnalysis: { engagementTrend: string; activityTrend: string; responseTrend: string; taskCompletionTrend: string; inactivityPeriods: Array<{ start: string; end: string; days: number }>; acceleration: string; evidence: string[] };
    turningPoints: Array<{ date: string; type: string; description: string; impact: string }>;
    anomalies: Array<{ type: string; description: string; severity: string; evidence: string[] }>;
    nextBestAction: { action: string; priority: string; why: string; expectedImpact: string[]; deadline: string | null };
    whatIfScenarios: Array<{ scenario: string; estimatedProbability: number | null; estimatedRisk: number | null; reasoning: string; confidence: string }>;
    dataQuality: { score: number; missingFields: string[]; completeness: Record<string, boolean>; impactOnConfidence: string };
    explainability: { positiveFactors: string[]; negativeFactors: string[]; neutralFactors: string[]; historicalEvidence: string[]; confidence: string; confidenceReason: string };
  };
  whatChanged?: string;
  behavioralPatterns?: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    confidence: string;
  }>;
  evidenceQuality?: EvidenceQuality;
  contradictions?: string[];
  dataQualityWarnings?: string[];
}

export interface TaskAnalysis {
  id: string;
  title: string;
  description: string | null;
  mode: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  completedAt: string | null;
  status: "open" | "completed" | null;
  relatedRecordName: string | null;
  companyName: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string | null;
  isOverdue: boolean;
  daysOverdue: number | null;
  daysUntilDue: number | null;
  relatedRecordStage: string | null;
  relatedRecordValueMinor: number | null;
  relatedRecordLastActivityAt: string | null;
  relatedRecordDaysSinceActivity: number | null;
  relatedRecordOpenDeals: number;
  priority: "high" | "medium" | "low";
  whyItMatters: string;
  recommendedNextSteps: string[];
  recommendedAction: StructuredRecommendedAction | null;
  relatedActivitiesSummary: string[];
  evidence: string[];
  evidenceQuality?: "strong" | "medium" | "weak" | "missing";
  overview: string;
}

export interface GlobalAnalysis {
  todayPriorities: Array<{
    type: string;
    id: string;
    label: string;
    reason: string;
    value: string;
  }>;
  atRiskDeals: Array<{
    id: string;
    name: string;
    company: string | null;
    stage: string | null;
    expectedValueMinor: number | null;
    riskLevel: string;
    reason: string;
  }>;
  customersRequiringAttention: Array<{
    id: string;
    name: string;
    reason: string;
    daysSinceActivity: number | null;
    openDeals: number;
  }>;
  overdueTasksSummary: {
    total: number;
    byAssignee: Record<string, number>;
    linkedToHighValueDeals: number;
  };
  followUpOpportunities: Array<{
    id: string;
    label: string;
    reason: string;
  }>;
  topPerformers: Array<{
    id: string;
    name: string;
    wonDeals: number;
    conversionRate: number;
  }>;
  timeline: Array<{
    date: string;
    events: Array<{
      kind: string;
      body: string;
      userName: string;
    }>;
  }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a);
  const db = new Date(b);
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function safeAll<T>(query: () => T[]): T[] {
  try { return query(); } catch { return []; }
}

function safeGet<T>(query: () => T, fallback: T): T {
  try { return query(); } catch { return fallback; }
}

/* ------------------------------------------------------------------ */
/* Customer Analysis                                                   */
/* ------------------------------------------------------------------ */

export function analyzeCustomer(customerId: string): CustomerAnalysis | null {
  const summary = getCustomerSummary(customerId);
  if (!summary) return null;

  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const lastActivityAt = summary.activitiesTimeline?.[0]?.occurredAt ?? null;
  const daysSinceLastActivity = daysBetween(lastActivityAt, now);

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE ((a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))`
        )
        .get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const totalTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))`
        )
        .get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const openTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
              AND t.completed_at IS NULL`
        )
        .get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const completedTasks = totalTasks - openTasks;
  const overdueTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
              AND t.completed_at IS NULL
              AND t.due_at IS NOT NULL
              AND date(t.due_at) < date('now')`
        )
        .get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const avgDealValueMinor = summary.totalDeals > 0 ? Math.round(summary.totalRevenueMinor / summary.totalDeals) : null;
  const dealValueInPipelineMinor = summary.openDeals > 0 ? summary.totalRevenueMinor : 0;

  const hasActiveOpportunities = summary.openDeals > 0;
  const hasOverdueFollowUps = overdueTasks > 0;
  const hasStaleDeals = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.deals} d
           WHERE d.establishment_id = ?
             AND d.deleted_at IS NULL
             AND (d.updated_at IS NULL OR d.updated_at < date('now', '-14 days'))`
        )
        .get(customerId) as { c: number },
    { c: 0 }
  ).c > 0;

  let engagementTrend: CustomerAnalysis["overview"] extends object ? never : "increasing" | "stable" | "decreasing" | "none" = "none";
  let temporalEvidence: string[] = [];
  try {
    const temporal = analyzeTemporalBehavior("customer", customerId);
    engagementTrend = temporal.trend as "increasing" | "stable" | "decreasing" | "none";
    temporalEvidence = temporal.evidence;
  } catch { /* temporal analysis is best-effort */ }

  let crossEntityContext: { activeDeals: number; activeLeads: number; totalPipelineMinor: number; overdueTasks: number; openTasks: number; relationshipInsights: string[] } | null = null;
  try {
    crossEntityContext = getCrossEntityContext(customerId);
  } catch { /* cross-entity context is best-effort */ }

  const riskReasons: string[] = [];
  const opportunityReasons: string[] = [];
  const recommendedActions: string[] = [];
  const evidence: string[] = [];
  const activitiesByType: Record<string, number> = {};

  for (const act of summary.activitiesTimeline || []) {
    const label = act.type || "Activity";
    activitiesByType[label] = (activitiesByType[label] || 0) + 1;
  }

  const timeline = [
    ...(summary.activitiesTimeline || []).slice(0, 10).map((a) => ({
      kind: "activity" as const,
      occurredAt: a.occurredAt,
      label: a.type,
      body: a.body,
      userName: a.userName,
    })),
    ...(summary.tasksTimeline || []).slice(0, 5).map((t) => ({
      kind: "task" as const,
      occurredAt: t.completedAt || t.dueAt || "",
      label: "Task",
      body: t.title,
      userName: t.assigneeName,
    })),
  ].sort((a, b) => {
    const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return tb - ta;
  });

  if (daysSinceLastActivity && daysSinceLastActivity > 30) {
    riskReasons.push(`Customer inactive for ${daysSinceLastActivity} days — strong churn risk`);
    evidence.push(`Last activity was ${daysSinceLastActivity} days ago`);
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    riskReasons.push(`No activity for ${daysSinceLastActivity} days — engagement declining`);
    evidence.push(`Last activity was ${daysSinceLastActivity} days ago`);
  }
  if (hasStaleDeals) {
    riskReasons.push("Contains deals with no recent activity (14+ days) — pipeline decay");
  }
  if (hasOverdueFollowUps) {
    riskReasons.push(`${overdueTasks} overdue follow-up task(s) — commitments not kept`);
  }
  if (summary.lostDeals > summary.wonDeals && summary.totalDeals > 0) {
    riskReasons.push(`${summary.lostDeals} lost deals vs ${summary.wonDeals} won — conversion challenges`);
  }
  if (summary.openDeals === 0 && summary.totalDeals > 0) {
    riskReasons.push("No active open deals — pipeline empty despite history");
  }
  if (engagementTrend === "decreasing" && hasActiveOpportunities) {
    riskReasons.push("Engagement is decreasing while active opportunities exist — relationship at risk");
  }
  if (crossEntityContext && crossEntityContext.overdueTasks > 2) {
    riskReasons.push(`${crossEntityContext.overdueTasks} overdue follow-up tasks across customer records — systematic follow-up gap`);
  }

  if (hasActiveOpportunities) {
    const pipelineValue = crossEntityContext ? crossEntityContext.totalPipelineMinor : dealValueInPipelineMinor;
    opportunityReasons.push(`${summary.openDeals} open deal(s) with pipeline value of ${(pipelineValue / 100).toFixed(2)} ${summary.currencyCode}`);
  }
  if (summary.wonDeals > 0) {
    opportunityReasons.push(`${summary.wonDeals} won deal(s) — proven customer`);
  }
  if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
    opportunityReasons.push("Recent activity indicates engaged relationship");
  }
  if (summary.totalDeals === 0 && totalActivities > 0) {
    opportunityReasons.push("Active communication but no deals yet — conversion opportunity");
  }
  if (crossEntityContext && crossEntityContext.activeLeads > 0) {
    opportunityReasons.push(`${crossEntityContext.activeLeads} active lead(s) in pipeline`);
  }
  if (engagementTrend === "increasing") {
    opportunityReasons.push("Engagement trend is increasing — relationship is strengthening");
  }

  if (daysSinceLastActivity && daysSinceLastActivity > 14 && hasActiveOpportunities) {
    recommendedActions.push("Re-engage immediately — active deals with no recent contact");
  }
  if (overdueTasks > 0) {
    recommendedActions.push(`Complete ${overdueTasks} overdue follow-up task(s) to restore trust`);
  }
  if (hasStaleDeals) {
    recommendedActions.push("Review and update stale deals to prevent further decay");
  }
  if (summary.openDeals > 0 && avgDealValueMinor && avgDealValueMinor > 0) {
    recommendedActions.push(`Prioritize follow-up on open deals worth ${(avgDealValueMinor / 100).toFixed(2)} on average`);
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue current engagement rhythm");
  }

  if (daysSinceLastActivity) evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  if (summary.source) evidence.push(`Source: ${summary.source}`);
  if (totalActivities > 0) evidence.push(`Total interactions: ${totalActivities}`);
  if (summary.openDeals > 0) evidence.push(`${summary.openDeals} active opportunity/opportunities`);
  if (crossEntityContext && crossEntityContext.totalPipelineMinor > 0) {
    evidence.push(`Pipeline value across all entities: ${(crossEntityContext.totalPipelineMinor / 100).toFixed(2)} SAR`);
  }
  evidence.push(...temporalEvidence.slice(0, 4));

  let riskLevel: CustomerAnalysis["riskLevel"] = "low";
  if (riskReasons.length >= 3) riskLevel = "critical";
  else if (riskReasons.length >= 2) riskLevel = "high";
  else if (riskReasons.length >= 1) riskLevel = "medium";

  let predictions: CustomerPredictions | null = null;
  try { predictions = predictCustomer(customerId); } catch { predictions = null; }

  return {
    id: summary.id,
    name: summary.name,
    ownerName: summary.ownerName,
    status: summary.status,
    totalDeals: summary.totalDeals,
    openDeals: summary.openDeals,
    wonDeals: summary.wonDeals,
    lostDeals: summary.lostDeals,
    totalRevenueMinor: summary.totalRevenueMinor,
    totalActivities,
    totalTasks,
    openTasks,
    completedTasks,
    overdueTasks,
    lastActivityAt,
    daysSinceLastActivity,
    avgDealValueMinor,
    dealValueInPipelineMinor: summary.totalRevenueMinor,
    hasActiveOpportunities,
    hasOverdueFollowUps,
    hasStaleDeals,
    riskLevel,
    riskReasons,
    opportunityReasons,
    recommendedActions,
    recommendedAction: (() => { try { return generateCustomerActionRecommendation(customerId); } catch { return null; } })(),
    evidence,
    overview: (() => {
      const pipelineValue = crossEntityContext ? crossEntityContext.totalPipelineMinor : dealValueInPipelineMinor;
      let narrative = `The customer has ${summary.openDeals > 0 ? `${summary.openDeals} open deal(s) in pipeline worth ${(pipelineValue / 100).toFixed(2)} ${summary.currencyCode}` : "no active open deals"}.`;

      if (engagementTrend === "increasing") {
        narrative += ` Engagement is strengthening, with increasing interaction frequency across the relationship.`;
      } else if (engagementTrend === "decreasing") {
        narrative += ` Engagement is weakening — activity volume has decreased compared to previous periods.`;
      } else if (daysSinceLastActivity && daysSinceLastActivity > 7) {
        narrative += ` Last activity was ${daysSinceLastActivity} days ago, indicating cooling engagement.`;
      } else if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
        narrative += ` Recent activity within the last week shows the relationship is currently active.`;
      }
      if (hasOverdueFollowUps) {
        narrative += ` There ${overdueTasks === 1 ? "is" : "are"} ${overdueTasks} overdue follow-up task(s) that require immediate action.`;
      }
      if (hasStaleDeals) {
        narrative += ` Some deals have had no recent activity for 14+ days, indicating potential pipeline decay.`;
      }
      if (daysSinceLastActivity && daysSinceLastActivity > 30) {
        narrative += ` The customer has been inactive for ${daysSinceLastActivity} days — this is a strong churn risk signal.`;
      }
      if (summary.wonDeals > 0 && summary.lostDeals === 0) {
        narrative += ` This is a proven customer with ${summary.wonDeals} won deal(s) and no losses.`;
      } else if (summary.lostDeals > summary.wonDeals && summary.totalDeals > 0) {
        narrative += ` The customer has more lost deals (${summary.lostDeals}) than won (${summary.wonDeals}), which warrants attention.`;
      }
      if (summary.totalDeals === 0 && totalActivities > 0) {
        narrative += ` Despite active communication, no deals have been closed yet — there is a conversion opportunity.`;
      }
      if (crossEntityContext && crossEntityContext.activeLeads > 0) {
        narrative += ` There ${crossEntityContext.activeLeads === 1 ? "is" : "are"} ${crossEntityContext.activeLeads} active lead(s) in the pipeline.`;
      }
      return narrative;
    })(),
    timeline: timeline.slice(0, 15),
    activitiesByType,
    predictions: predictions ? {
      churnRisk: predictions.churnRisk,
      followUpPriority: predictions.followUpPriority,
      engagementScore: predictions.engagementScore,
    } : undefined,
    enhancedPredictions: (() => { try { const p = predictCustomerEnhanced(customerId); return p ? { relationshipHealth: p.relationshipHealth, opportunityScore: p.opportunityScore, nextBestAction: p.nextBestAction, dataQuality: p.dataQuality } : undefined; } catch { return undefined; } })(),
    whatChanged: (() => { try { const c = detectChanges("customer", customerId); return c.hasChange ? c.summary : "No significant change detected."; } catch { return "Change analysis unavailable."; } })(),
    behavioralPatterns: (() => { try { return detectBehavioralPatterns("customer", customerId); } catch { return []; } })(),
    evidenceQuality: assessEvidenceQuality(evidence).quality,
    contradictions: (() => { try { const c = validateContradictions("customer", { riskLevel, daysSinceLastActivity, hasActiveOpportunities }); return c.contradictions; } catch { return []; } })(),
    dataQualityWarnings: (() => { try { const dq = assessRecordDataQuality("customer", summary); return dq.warnings; } catch { return []; } })(),
  };
}

/* ------------------------------------------------------------------ */
/* Lead Analysis                                                       */
/* ------------------------------------------------------------------ */

export function analyzeLead(leadId: string): LeadAnalysis | null {
  const summary = getLeadSummary(leadId);
  if (!summary) return null;

  const db = getDb();
  const now = new Date().toISOString().split("T")[0];
  const ageDays = summary.created_at ? daysBetween(summary.created_at, now) : null;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE (a.entity_type = 'lead' AND a.entity_id = ?)
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT d.id FROM ${TABLES.deals} d WHERE d.lead_id = ? AND d.deleted_at IS NULL))`
        )
        .get(leadId, leadId) as { c: number },
    { c: 0 }
  ).c;

  const totalTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE (t.entity_type = 'lead' AND t.entity_id = ?)
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT d.id FROM ${TABLES.deals} d WHERE d.lead_id = ? AND d.deleted_at IS NULL))`
        )
        .get(leadId, leadId) as { c: number },
    { c: 0 }
  ).c;

  const openTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id = ?)
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT d.id FROM ${TABLES.deals} d WHERE d.lead_id = ? AND d.deleted_at IS NULL)))
             AND t.completed_at IS NULL`
        )
        .get(leadId, leadId) as { c: number },
    { c: 0 }
  ).c;

  const completedTasks = totalTasks - openTasks;
  const overdueTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id = ?)
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT d.id FROM ${TABLES.deals} d WHERE d.lead_id = ? AND d.deleted_at IS NULL)))
             AND t.completed_at IS NULL
             AND t.due_at IS NOT NULL
             AND date(t.due_at) < date('now')`
        )
        .get(leadId, leadId) as { c: number },
    { c: 0 }
  ).c;

  const lastActivityAt = summary.activitiesTimeline?.[0]?.occurredAt ?? null;
  const daysSinceLastActivity = daysBetween(lastActivityAt, now);

  const nowDate = new Date();
  const recentActivities = (summary.activitiesTimeline || []).filter((a) => {
    const d = new Date(a.occurredAt);
    const diff = (nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  const olderActivities = (summary.activitiesTimeline || []).filter((a) => {
    const d = new Date(a.occurredAt);
    const diff = (nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 7 && diff <= 14;
  });
  let engagementTrend: LeadAnalysis["engagementTrend"] = "none";
  if (recentActivities.length === 0 && totalActivities > 0) {
    engagementTrend = "decreasing";
  } else if (recentActivities.length > 0 && olderActivities.length === 0 && totalActivities > 0) {
    engagementTrend = "stable";
  } else if (recentActivities.length > olderActivities.length) {
    engagementTrend = "increasing";
  } else if (recentActivities.length < olderActivities.length && recentActivities.length > 0) {
    engagementTrend = "decreasing";
  } else if (recentActivities.length > 0 && olderActivities.length > 0) {
    engagementTrend = "stable";
  }

  let leadTemporalEvidence: string[] = [];
  try {
    const temporal = analyzeTemporalBehavior("lead", leadId);
    if (temporal.trend === "increasing") engagementTrend = "increasing";
    else if (temporal.trend === "decreasing") engagementTrend = "decreasing";
    leadTemporalEvidence = temporal.evidence.slice(0, 3);
  } catch { /* temporal analysis is best-effort */ }

  const conversionPotential: LeadAnalysis["conversionPotential"] =
    summary.probabilityPct && summary.probabilityPct >= 50 ? "high"
      : summary.probabilityPct && summary.probabilityPct >= 25 ? "medium"
      : "low";

  let health: LeadAnalysis["health"] = "healthy";
  const riskReasons: string[] = [];
  const opportunityReasons: string[] = [];
  const recommendedActions: string[] = [];
  const evidence: string[] = [];

  if (daysSinceLastActivity && daysSinceLastActivity > 30) {
    riskReasons.push(`No activity for ${daysSinceLastActivity} days — lead has gone cold`);
    health = "stale";
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    riskReasons.push(`No activity for ${daysSinceLastActivity} days — engagement declining`);
    if (health === "healthy") health = "at-risk";
  }
  if (overdueTasks > 0) {
    riskReasons.push(`${overdueTasks} overdue follow-up task(s) — commitment gap`);
    if (health !== "stale") health = "at-risk";
  }
  if (summary.stage === "junk" || summary.stage === "lost") {
    riskReasons.push(`Stage is ${summary.stage} — lead is disqualified`);
    health = "cold";
  }
  if (ageDays && ageDays > 30 && engagementTrend === "decreasing") {
    riskReasons.push(`Lead is ${ageDays} days old with decreasing engagement — aging without progression`);
  }
  if (summary.dealsCount === 0 && totalActivities > 5) {
    opportunityReasons.push("High activity but no deals yet — review qualification process");
  }
  if (summary.openDeals > 0) {
    opportunityReasons.push(`${summary.openDeals} open deal(s) in progress`);
  }
  if (engagementTrend === "increasing") {
    opportunityReasons.push("Engagement is increasing — positive momentum");
  }
  if (summary.probabilityPct && summary.probabilityPct >= 70) {
    opportunityReasons.push(`High conversion probability: ${summary.probabilityPct}%`);
  }
  if (summary.stage === "Qualified" || summary.stage === "Proposal" || summary.stage === "Negotiation") {
    opportunityReasons.push(`Advanced stage (${summary.stage}) indicates strong qualification`);
  }

  if (health === "stale" || health === "at-risk") {
    recommendedActions.push("Schedule a follow-up call or meeting immediately to re-engage");
  }
  if (overdueTasks > 0) {
    recommendedActions.push("Complete overdue tasks to restore engagement rhythm");
  }
  if (summary.openDeals === 0 && totalActivities >= 3) {
    recommendedActions.push("Convert existing engagement into a formal deal");
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue nurturing this lead");
  }

  if (daysSinceLastActivity) evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  if (summary.created_at) evidence.push(`Lead age: ${ageDays} days`);
  if (summary.source) evidence.push(`Source: ${summary.source}`);
  if (summary.probabilityPct !== null) evidence.push(`CRM conversion probability: ${summary.probabilityPct}%`);
  if (totalActivities > 0) evidence.push(`Total interactions: ${totalActivities}`);
  evidence.push(...leadTemporalEvidence.slice(0, 3));
  if (summary.openDeals > 0) evidence.push(`${summary.openDeals} active opportunity/opportunities`);
  evidence.push(...leadTemporalEvidence.slice(0, 3));

  const timeline = [
    { kind: "lead_created" as const, occurredAt: summary.created_at || "", label: "Lead Created", body: summary.fullName, userName: "" },
    ...recentActivities.map((a) => ({
      kind: "activity" as const,
      occurredAt: a.occurredAt,
      label: a.type,
      body: a.body,
      userName: a.userName,
    })),
    ...(summary.tasksTimeline || []).slice(0, 3).map((t) => ({
      kind: "task" as const,
      occurredAt: t.completedAt || t.dueAt || "",
      label: "Task",
      body: t.title,
      userName: t.assigneeName,
    })),
  ].sort((a, b) => {
    const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return tb - ta;
  });

  return {
    id: summary.id,
    fullName: summary.fullName,
    company: summary.company,
    stage: summary.stage,
    source: summary.source,
    ownerName: summary.ownerName,
    probabilityPct: summary.probabilityPct,
    created_at: summary.created_at,
    ageDays,
    totalDeals: summary.dealsCount,
    openDeals: summary.openDeals,
    wonDeals: summary.wonDeals,
    lostDeals: summary.lostDeals,
    totalRevenueMinor: summary.totalRevenueMinor,
    totalActivities,
    totalTasks,
    openTasks,
    completedTasks,
    overdueTasks,
    lastActivityAt,
    daysSinceLastActivity,
    engagementTrend,
    conversionPotential,
    health,
    riskReasons,
    opportunityReasons,
    recommendedActions,
    recommendedAction: (() => { try { return generateLeadActionRecommendation(leadId); } catch { return null; } })(),
    evidence,
    overview: (() => {
      const stageInfo = summary.stage ? `in the ${summary.stage} stage` : "stage unknown";
      const ageInfo = ageDays ? `${ageDays} days old` : "age unknown";
      let narrative = `This lead is ${stageInfo} and ${ageInfo}.`;

      if (engagementTrend === "increasing") {
        narrative += ` Engagement is increasing, which is a strong conversion signal.`;
      } else if (engagementTrend === "decreasing") {
        narrative += ` Engagement is decreasing — the lead is losing interest.`;
      } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
        narrative += ` No activity has been recorded for ${daysSinceLastActivity} days — the lead has gone cold and requires immediate re-engagement.`;
      } else if (daysSinceLastActivity && daysSinceLastActivity > 7) {
        narrative += ` Last activity was ${daysSinceLastActivity} days ago — engagement is cooling.`;
      } else if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
        narrative += ` Recent activity within the last week shows the lead is still warm.`;
      }
      if (conversionPotential === "high") {
        narrative += ` Conversion potential is high.`;
      } else if (conversionPotential === "low") {
        narrative += ` Conversion potential is currently low.`;
      }
      if (summary.openDeals > 0) {
        narrative += ` The lead has ${summary.openDeals} open deal(s).`;
      }
      if (overdueTasks > 0) {
        narrative += ` There ${overdueTasks === 1 ? "is" : "are"} ${overdueTasks} overdue task(s).`;
      }
      if (summary.dealsCount === 0 && totalActivities >= 3) {
        narrative += ` High activity but no deals yet — review qualification criteria.`;
      }
      if (summary.stage === "Qualified" || summary.stage === "Proposal" || summary.stage === "Negotiation") {
        narrative += ` The lead is in an advanced stage (${summary.stage}), indicating strong qualification.`;
      }
      return narrative;
    })(),
    timeline: timeline.slice(0, 15),
    predictions: (() => { try { const p = predictLead(leadId); return p ? { conversionProbability: p.conversionProbability, followUpPriority: p.followUpPriority, engagementScore: p.engagementScore } : undefined; } catch { return undefined; } })(),
    enhancedPredictions: (() => { try { const p = predictLeadEnhanced(leadId); return p ? { leadHealth: p.leadHealth, opportunityScore: p.opportunityScore, nextBestAction: p.nextBestAction, dataQuality: p.dataQuality } : undefined; } catch { return undefined; } })(),
    whatChanged: (() => { try { const c = detectChanges("lead", leadId); return c.hasChange ? c.summary : "No significant change detected."; } catch { return "Change analysis unavailable."; } })(),
    behavioralPatterns: (() => { try { return detectBehavioralPatterns("lead", leadId); } catch { return []; } })(),
    evidenceQuality: assessEvidenceQuality(evidence).quality,
    contradictions: (() => { try { const c = validateContradictions("lead", { stage: summary.stage, health, daysSinceLastActivity, engagementTrend }); return c.contradictions; } catch { return []; } })(),
    dataQualityWarnings: (() => { try { const dq = assessRecordDataQuality("lead", summary); return dq.warnings; } catch { return []; } })(),
  };
}

/* ------------------------------------------------------------------ */
/* Deal Analysis                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Deal Analysis                                                       */
/* ------------------------------------------------------------------ */

function buildDealStageProgression(dealId: string): {
  stagesProgression: Array<{ stage: string; changedAt: string | null; durationDays: number | null }>;
  stageSummary: { totalStageChanges: number; currentStageAge: number | null; totalDealAge: number | null; avgStageDuration: number | null; isProlongedInCurrentStage: boolean };
} {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const stageChanges = safeAll(
    () =>
      db
        .prepare(
          `SELECT al.action, al.before, al.after, al.created_at, ps.label AS stage_label
           FROM ${TABLES.audit_log} al
           LEFT JOIN ${TABLES.stages} ps ON ps.id = json_extract(al.after, '$.stageId')
           WHERE al.entity_type = 'deal' AND al.entity_id = ? AND al.action = 'stage_change'
           ORDER BY al.created_at ASC`
        )
        .all(dealId) as Array<{
          action: string;
          before: string | null;
          after: string | null;
          created_at: string | null;
          stage_label: string | null;
        }>
  );

  const deal = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.created_at, d.updated_at, d.stage_id, ps.label AS stage_label
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
           WHERE d.id = ? AND d.deleted_at IS NULL
           LIMIT 1`
        )
        .get(dealId) as { created_at: string | null; updated_at: string | null; stage_id: string | null; stage_label: string | null } | undefined,
    undefined
  );

  const stagesProgression: Array<{ stage: string; changedAt: string | null; durationDays: number | null }> = [];
  const stageDurations: number[] = [];

  if (stageChanges.length === 0 && deal) {
    stagesProgression.push({
      stage: deal.stage_label || "Unknown",
      changedAt: deal.created_at ? deal.created_at.split("T")[0] : null,
      durationDays: deal.created_at ? daysBetween(deal.created_at.split("T")[0], now) : null,
    });
  } else if (stageChanges.length > 0) {
    const initialBefore = stageChanges[0].before;
    let initialStageId: string | null = null;
    if (initialBefore) {
      try {
        const parsed = JSON.parse(initialBefore);
        initialStageId = parsed.stageId || null;
      } catch {
        initialStageId = null;
      }
    }

    if (initialStageId) {
      const initialStage = safeGet(
        () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(initialStageId) as { label: string | null } | undefined,
        undefined
      );
      const firstChangeAt = stageChanges[0].created_at ? stageChanges[0].created_at.split("T")[0] : null;
      stagesProgression.push({
        stage: initialStage?.label || "Unknown",
        changedAt: firstChangeAt,
        durationDays: firstChangeAt && deal?.created_at ? daysBetween(deal.created_at.split("T")[0], firstChangeAt) : null,
      });
    }

    for (let i = 0; i < stageChanges.length; i++) {
      const change = stageChanges[i];
      const changedAt = change.created_at ? change.created_at.split("T")[0] : null;
      const afterJson = change.after ? JSON.parse(change.after) : null;
      const newStageId = afterJson?.stageId || null;

      let stageLabel = "Unknown";
      if (newStageId) {
        const stage = safeGet(
          () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(newStageId) as { label: string | null } | undefined,
          undefined
        );
        stageLabel = stage?.label || "Unknown";
      }

      const nextChangeAt = i < stageChanges.length - 1 ? stageChanges[i + 1].created_at?.split("T")[0] : null;
      const endDate = nextChangeAt || now;
      const durationDays = changedAt ? daysBetween(changedAt, endDate) : null;

      stagesProgression.push({
        stage: stageLabel,
        changedAt,
        durationDays,
      });

      if (durationDays !== null) {
        stageDurations.push(durationDays);
      }
    }
  }

  const totalStageChanges = stageChanges.length;
  const currentStageAge = stagesProgression.length > 0 ? stagesProgression[stagesProgression.length - 1].durationDays : null;
  const totalDealAge = deal?.created_at ? daysBetween(deal.created_at.split("T")[0], now) : null;
  const avgStageDuration = stageDurations.length > 0 ? Math.round(stageDurations.reduce((a, b) => a + b, 0) / stageDurations.length) : null;
  const isProlongedInCurrentStage = currentStageAge !== null && currentStageAge > 21;

  return {
    stagesProgression,
    stageSummary: {
      totalStageChanges,
      currentStageAge,
      totalDealAge,
      avgStageDuration,
      isProlongedInCurrentStage,
    },
  };
}

export function analyzeDeal(dealId: string): DealAnalysis | null {
  const summary = getDealSummary(dealId);
  if (!summary) return null;

  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const ageDays = summary.created_at ? daysBetween(summary.created_at, now) : null;
  const daysSinceUpdate = summary.updated_at ? daysBetween(summary.updated_at, now) : null;
  const daysSinceLastActivity = summary.activitiesTimeline?.[0]?.occurredAt
    ? daysBetween(summary.activitiesTimeline[0].occurredAt, now)
    : null;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const totalTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const openTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const completedTasks = totalTasks - openTasks;
  const overdueTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const activityFrequencyPerWeek = totalActivities > 0 && ageDays && ageDays > 0
    ? Number(((totalActivities / ageDays) * 7).toFixed(1))
    : null;

  let engagementTrend: DealAnalysis["engagementTrend"] = "none";
  const nowDate = new Date();
  const recentActivities = (summary.activitiesTimeline || []).filter((a) => {
    const d = new Date(a.occurredAt);
    const diff = (nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  const olderActivities = (summary.activitiesTimeline || []).filter((a) => {
    const d = new Date(a.occurredAt);
    const diff = (nowDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 7 && diff <= 14;
  });
  if (recentActivities.length === 0 && totalActivities > 0) {
    engagementTrend = "decreasing";
  } else if (recentActivities.length > 0 && olderActivities.length === 0 && totalActivities > 0) {
    engagementTrend = "stable";
  } else if (recentActivities.length > olderActivities.length) {
    engagementTrend = "increasing";
  } else if (recentActivities.length < olderActivities.length && recentActivities.length > 0) {
    engagementTrend = "decreasing";
  } else if (recentActivities.length > 0 && olderActivities.length > 0) {
    engagementTrend = "stable";
  }

  let dealTemporalEvidence: string[] = [];
  try {
    const temporal = analyzeTemporalBehavior("deal", dealId);
    if (temporal.trend === "decreasing" && engagementTrend !== "decreasing") engagementTrend = "decreasing";
    else if (temporal.trend === "increasing" && engagementTrend !== "increasing") engagementTrend = "increasing";
    dealTemporalEvidence = temporal.evidence.slice(0, 4);
  } catch { /* temporal analysis is best-effort */ }

  let stageInsights: { insights: string[]; warnings: string[]; confidence: "high" | "medium" | "low" } | null = null;
  try {
    const stageId = safeGet(
      () => db.prepare(`SELECT stage_id FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(dealId) as { stage_id: string | null } | undefined,
      undefined
    );
    const sid = stageId?.stage_id || null;
    stageInsights = getStageAwareInsights(sid, summary.expectedValueMinor, daysSinceUpdate, daysSinceLastActivity);
  } catch { /* stage insights are best-effort */ }

  const isStalled = (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    (daysSinceUpdate !== null && daysSinceUpdate > 14);
  const isOverdue = summary.targetCloseDate && new Date(summary.targetCloseDate) < new Date() && !summary.status;

  let health: DealAnalysis["health"] = "healthy";
  const riskReasons: string[] = [];
  const opportunityReasons: string[] = [];
  const recommendedActions: string[] = [];
  const evidence: string[] = [];
  const missingInformation: string[] = [];

  if (isStalled) {
    if (daysSinceLastActivity) {
      if (daysSinceLastActivity > 30) {
        riskReasons.push(`Deal has been inactive for ${daysSinceLastActivity} days — significant loss of momentum`);
      } else if (daysSinceLastActivity > 14) {
        riskReasons.push(`No activity recorded for ${daysSinceLastActivity} days — engagement is declining`);
      } else {
        riskReasons.push(`No recent activity (${daysSinceLastActivity} days)`);
      }
    } else {
      riskReasons.push("No recent activity recorded — deal appears stalled");
    }
    health = "stalled";
  }
  if (isOverdue) {
    riskReasons.push(`Past target close date (${summary.targetCloseDate}) without closure`);
    health = health === "stalled" ? "critical" : "at-risk";
  }
  if (overdueTasks > 0) {
    riskReasons.push(`${overdueTasks} overdue task(s) indicate incomplete follow-up commitments`);
    if (health === "healthy") health = "at-risk";
  }
  if (summary.probabilityPct !== null && summary.probabilityPct < 20) {
    riskReasons.push(`CRM probability is low (${summary.probabilityPct}%)`);
  }
  if (!summary.expectedValueMinor) {
    missingInformation.push("Expected value not set — cannot assess deal worth");
  }
  if (!summary.targetCloseDate) {
    missingInformation.push("Target close date missing — timeline unclear");
  }
  if (totalActivities === 0) {
    missingInformation.push("No activities recorded — no interaction history to evaluate");
  }

  if (summary.probabilityPct && summary.probabilityPct >= 70 && isStalled) {
    riskReasons.push(`Probability/Evidence Mismatch: CRM shows ${summary.probabilityPct}% win probability but deal is stalled with no recent activity — confidence in this probability should be reduced`);
  }
  if (summary.probabilityPct && summary.probabilityPct >= 70 && daysSinceLastActivity && daysSinceLastActivity > 21) {
    riskReasons.push(`Probability/Evidence Mismatch: Stored probability is ${summary.probabilityPct}% but no activity for ${daysSinceLastActivity} days — probability may be overstated`);
  }
  if (stageInsights) {
    for (const warning of stageInsights.warnings) {
      if (!riskReasons.includes(warning)) riskReasons.push(warning);
    }
  }

  if (summary.probabilityPct && summary.probabilityPct >= 70) {
    opportunityReasons.push(`High CRM probability (${summary.probabilityPct}%) signals strong closing potential`);
  }
  if (summary.expectedValueMinor && summary.expectedValueMinor > 0) {
    opportunityReasons.push(`High-value opportunity worth ${(summary.expectedValueMinor / 100).toFixed(2)} SAR`);
  }
  if (engagementTrend === "increasing") {
    opportunityReasons.push("Recent engagement trend is positive");
  }
  if (summary.stage === "Proposal" || summary.stage === "Negotiation") {
    opportunityReasons.push(`Advanced stage (${summary.stage}) indicates buyer commitment`);
  }
  if (isStalled && summary.probabilityPct && summary.probabilityPct >= 40) {
    opportunityReasons.push("Underlying CRM probability remains moderate — deal is recoverable with re-engagement");
  }
  if (stageInsights) {
    for (const insight of stageInsights.insights) {
      if (!opportunityReasons.includes(insight) && !riskReasons.includes(insight)) {
        opportunityReasons.push(insight);
      }
    }
  }

  if (health === "stalled" || health === "critical") {
    recommendedActions.push("Re-engage the customer immediately with a call or meeting to recover momentum");
  }
  if (isOverdue) {
    recommendedActions.push("Review deal status — past target close date requires immediate update or closure");
  }
  if (overdueTasks > 0) {
    recommendedActions.push(`Complete ${overdueTasks} overdue follow-up task(s) to restore customer confidence`);
  }
  if (isStalled && !isOverdue && summary.targetCloseDate) {
    const daysUntilClose = daysBetween(now, summary.targetCloseDate);
    if (daysUntilClose !== null && daysUntilClose < 14) {
      recommendedActions.push("Update or advance the deal stage before the target close date passes");
    }
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue current engagement and monitor deal progression");
  }

  if (daysSinceLastActivity) evidence.push(`Last activity was ${daysSinceLastActivity} days ago`);
  if (ageDays) evidence.push(`Deal age: ${ageDays} days in pipeline`);
  if (summary.targetCloseDate) evidence.push(`Target close date: ${summary.targetCloseDate}`);
  if (activityFrequencyPerWeek !== null) evidence.push(`Activity frequency: ${activityFrequencyPerWeek} interactions per week`);
  if (summary.expectedValueMinor && summary.expectedValueMinor > 0) evidence.push(`Expected value: ${(summary.expectedValueMinor / 100).toFixed(2)} SAR`);
  if (stageInsights) {
    evidence.push(...stageInsights.insights.slice(0, 3));
  }
  evidence.push(...dealTemporalEvidence.slice(0, 3));

  const timeline = [
    { kind: "deal_created" as const, occurredAt: summary.created_at || "", label: "Deal Created", body: summary.name, userName: "" },
    ...(summary.activitiesTimeline || []).slice(0, 8).map((a) => ({
      kind: "activity" as const,
      occurredAt: a.occurredAt,
      label: a.type,
      body: a.body,
      userName: a.userName,
    })),
    ...(summary.tasksTimeline || []).slice(0, 3).map((t) => ({
      kind: "task" as const,
      occurredAt: t.completedAt || t.dueAt || "",
      label: "Task",
      body: t.title,
      userName: t.assigneeName,
    })),
  ].sort((a, b) => {
    const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return tb - ta;
  });

  const stageProgressionData = buildDealStageProgression(dealId);

  return {
    id: summary.id,
    name: summary.name,
    company: summary.company,
    leadName: summary.leadName,
    stage: summary.stage,
    ownerName: summary.ownerName,
    expectedValueMinor: summary.expectedValueMinor,
    wonValueMinor: summary.wonValueMinor,
    probabilityPct: summary.probabilityPct,
    targetCloseDate: summary.targetCloseDate,
    status: summary.status,
    created_at: summary.created_at,
    updated_at: summary.updated_at,
    ageDays,
    daysSinceLastActivity,
    daysInCurrentStage: daysSinceUpdate,
    totalActivities,
    totalTasks,
    openTasks,
    completedTasks,
    overdueTasks,
    activityFrequencyPerWeek,
    engagementTrend,
    isStalled,
    isOverdue: !!isOverdue,
    health,
    riskReasons,
    opportunityReasons,
    recommendedActions,
    recommendedAction: (() => { try { return generateDealActionRecommendation(dealId); } catch { return null; } })(),
    evidence,
    missingInformation,
    overview: (() => {
      const stageInfo = summary.stage ? `in the ${summary.stage} stage` : "stage unknown";
      const ageInfo = ageDays ? `${ageDays} days old` : "age unknown";
      let narrative = `This deal is ${stageInfo} and ${ageInfo}.`;

      if (isStalled) {
        if (daysSinceLastActivity && daysSinceLastActivity > 30) {
          narrative += ` It has remained in ${stageInfo} without progression for an extended period, and no activity has been recorded for ${daysSinceLastActivity} days, which indicates a significant loss of momentum.`;
        } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
          narrative += ` No activity has been recorded for ${daysSinceLastActivity} days, indicating declining engagement and risk of stagnation.`;
        } else {
          narrative += ` The deal appears stalled with no recent updates or activity.`;
        }
      } else if (engagementTrend === "decreasing") {
        narrative += ` Engagement is decreasing — activity has dropped compared to previous weeks.`;
      } else if (engagementTrend === "increasing") {
        narrative += ` Engagement is increasing with recent customer interaction.`;
      }

      if (isOverdue) {
        narrative += ` The deal is past its target close date (${summary.targetCloseDate}) without being marked as won or lost.`;
      }
      if (overdueTasks > 0) {
        narrative += ` There ${overdueTasks === 1 ? "is" : "are"} ${overdueTasks} overdue follow-up task(s) that need immediate attention.`;
      }
      if (summary.expectedValueMinor && summary.expectedValueMinor > 0) {
        narrative += ` The expected value is ${(summary.expectedValueMinor / 100).toFixed(2)} SAR.`;
      }
      if (summary.probabilityPct && summary.probabilityPct >= 70 && isStalled) {
        narrative += ` Note: CRM probability is ${summary.probabilityPct}% but the deal is stalled with no recent activity — this probability may be overstated.`;
      }
      if (missingInformation.length > 0) {
        narrative += ` Key information is missing: ${missingInformation.join(", ")}.`;
      }
      if (totalActivities === 0 && !isStalled) {
        narrative += ` No activities have been recorded yet, so there is no interaction history to evaluate.`;
      }
      return narrative;
    })(),
    timeline: timeline.slice(0, 15),
    stagesProgression: stageProgressionData.stagesProgression,
    stageSummary: stageProgressionData.stageSummary,
    predictions: (() => { try { const p = predictDeal(dealId); return p ? { winProbability: p.winProbability, stagnationRisk: p.stagnationRisk, followUpPriority: p.followUpPriority, engagementScore: p.engagementScore } : undefined; } catch { return undefined; } })(),
    enhancedPredictions: (() => { try { const p = predictDealEnhanced(dealId); return p ? { aiWinProbability: p.aiWinProbability, aiLossProbability: p.aiLossProbability, aiStallProbability: p.aiStallProbability, overallConfidence: p.overallConfidence, expectedCloseWindow: p.expectedCloseWindow, dealHealth: p.dealHealth, riskScore: p.riskScore, opportunityScore: p.opportunityScore, historicalBenchmark: p.historicalBenchmark, similarDeals: p.similarDeals, temporalAnalysis: p.temporalAnalysis, turningPoints: p.turningPoints, anomalies: p.anomalies, nextBestAction: p.nextBestAction, whatIfScenarios: p.whatIfScenarios, dataQuality: p.dataQuality, explainability: p.explainability } : undefined; } catch { return undefined; } })(),
    whatChanged: (() => { try { const c = detectChanges("deal", dealId); return c.hasChange ? c.summary : "No significant change detected."; } catch { return "Change analysis unavailable."; } })(),
    behavioralPatterns: (() => { try { return detectBehavioralPatterns("deal", dealId); } catch { return []; } })(),
    evidenceQuality: assessEvidenceQuality(evidence).quality,
    contradictions: (() => { try { const c = validateContradictions("deal", { status, health, isStalled, daysSinceLastActivity, engagementTrend, probabilityPct: summary.probabilityPct, riskReasons, hasActiveOpportunities: true }); return c.contradictions; } catch { return []; } })(),
    dataQualityWarnings: (() => { try { const dq = assessRecordDataQuality("deal", summary); return dq.warnings; } catch { return []; } })(),
  };
}

/* ------------------------------------------------------------------ */
/* Task Analysis                                                       */
/* ------------------------------------------------------------------ */

export function analyzeTask(taskId: string): TaskAnalysis | null {
  const db = getDb();
  const task = db
    .prepare(`SELECT t.*, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.id = ? LIMIT 1`)
    .get(taskId) as Record<string, unknown> | undefined;

  if (!task) return null;

  const entityType = task.entity_type as string | null;
  const entityId = task.entity_id as string | null;
  const title = task.title as string;
  const dueAt = task.due_at as string | null;
  const completedAt = task.completed_at as string | null;
  const status = completedAt ? "completed" : "open";
  const now = new Date().toISOString().split("T")[0];

  const isOverdue = status === "open" && dueAt && new Date(dueAt) < new Date();
  const daysOverdue = isOverdue ? daysBetween(now, dueAt) : null;
  const daysUntilDue = !isOverdue && dueAt ? daysBetween(now, dueAt) : null;

  let relatedRecordName: string | null = null;
  let companyName: string | null = null;
  let relatedRecordStage: string | null = null;
  let relatedRecordValueMinor: number | null = null;
  let relatedRecordLastActivityAt: string | null = null;
  let relatedRecordDaysSinceActivity: number | null = null;
  let relatedRecordOpenDeals = 0;

  if (entityType === "lead" && entityId) {
    const lead = db
      .prepare(`SELECT full_name, establishment_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`)
      .get(entityId) as { full_name: string | null; establishment_id: string | null } | undefined;
    if (lead) {
      relatedRecordName = lead.full_name;
      if (lead.establishment_id) {
        const cust = db
          .prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? LIMIT 1`)
          .get(lead.establishment_id) as { name: string | null } | undefined;
        companyName = cust?.name ?? null;
      }
    }
  } else if (entityType === "deal" && entityId) {
    const deal = db
      .prepare(`SELECT name, expected_value_minor, establishment_id, stage_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`)
      .get(entityId) as { name: string | null; expected_value_minor: number | null; establishment_id: string | null; stage_id: string | null } | undefined;
    if (deal) {
      relatedRecordName = deal.name;
      relatedRecordValueMinor = deal.expected_value_minor;
      if (deal.establishment_id) {
        const cust = db
          .prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? LIMIT 1`)
          .get(deal.establishment_id) as { name: string | null } | undefined;
        companyName = cust?.name ?? null;
      }
      if (deal.stage_id) {
        const stage = db
          .prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`)
          .get(deal.stage_id) as { label: string | null } | undefined;
        relatedRecordStage = stage?.label ?? null;
      }
    }
  } else if (entityType === "establishment" && entityId) {
    const est = db
      .prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? LIMIT 1`)
      .get(entityId) as { name: string | null } | undefined;
    relatedRecordName = est?.name ?? null;
    companyName = est?.name ?? null;
  }

  if (entityId && entityType) {
    const lastAct = safeGet(
      () =>
        db
          .prepare(
            `SELECT MAX(a.occurred_at) AS last_activity
             FROM ${TABLES.activities} a
             WHERE a.entity_type = ? AND a.entity_id = ?`
          )
          .get(entityType, entityId) as { last_activity: string | null },
      { last_activity: null }
    );
    relatedRecordLastActivityAt = lastAct.last_activity;
    relatedRecordDaysSinceActivity = daysBetween(relatedRecordLastActivityAt, now);
  }

  if (entityType === "establishment" && entityId) {
    relatedRecordOpenDeals = safeGet(
      () =>
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM ${TABLES.deals} d
             WHERE d.establishment_id = ? AND d.deleted_at IS NULL
               AND (d.updated_at IS NULL OR d.updated_at >= date('now', '-30 days'))`
          )
          .get(entityId) as { c: number },
      { c: 0 }
    ).c;
  }

  const relatedActivities: Array<{
    body: string | null;
    occurred_at: string | null;
    user_name: string | null;
    label: string | null;
  }> = [];

  if (entityType && entityId) {
    relatedActivities.push(
      ...safeAll(
        () =>
          db
            .prepare(
              `SELECT a.body, a.occurred_at, u.name AS user_name, at.label AS label
               FROM ${TABLES.activities} a
               LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
               LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
               WHERE a.entity_type = ? AND a.entity_id = ?
               ORDER BY a.occurred_at DESC LIMIT 5`
            )
            .all(entityType, entityId) as Array<{
              body: string | null;
              occurred_at: string | null;
              user_name: string | null;
              label: string | null;
            }>
      )
    );
  }

  const evidence: string[] = [];
  const recommendedNextSteps: string[] = [];
  const relatedActivitiesSummary: string[] = [];

  if (isOverdue) {
    evidence.push(`Task is overdue by ${Math.abs(daysOverdue || 0)} days`);
    recommendedNextSteps.push("Complete this task immediately");
  }
  if (relatedRecordValueMinor && relatedRecordValueMinor > 0) {
    evidence.push(`Related to ${entityType} with value ${(relatedRecordValueMinor / 100).toFixed(2)}`);
  }
  if (relatedRecordStage) {
    evidence.push(`Related record stage: ${relatedRecordStage}`);
  }
  if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 14) {
    evidence.push(`Related record has no activity for ${relatedRecordDaysSinceActivity} days`);
    recommendedNextSteps.push("Check if the related record needs attention before completing this task");
  }
  if (relatedRecordOpenDeals > 0) {
    evidence.push(`Related customer has ${relatedRecordOpenDeals} open deal(s)`);
  }
  if (isOverdue && relatedRecordValueMinor && relatedRecordValueMinor > 500000) {
    evidence.push(`High-value overdue task linked to deal worth ${(relatedRecordValueMinor / 100).toFixed(2)} — priority escalation recommended`);
  }

  relatedActivities.forEach((a) => {
    if (a.body) relatedActivitiesSummary.push(`[${a.occurred_at?.split("T")[0] || ""}] ${a.label || "Activity"}: ${a.body}`);
  });

  let priority: TaskAnalysis["priority"] = "medium";
  if (isOverdue && relatedRecordValueMinor && relatedRecordValueMinor > 0) priority = "high";
  else if (isOverdue) priority = "high";
  else if (relatedRecordValueMinor && relatedRecordValueMinor > 0) priority = "medium";
  else priority = "low";

  let whyItMatters = "";
  if (relatedRecordName) {
    whyItMatters = `This task is linked to ${relatedRecordName}`;
    if (companyName) whyItMatters += ` (${companyName})`;
    whyItMatters += ". ";
  }
  if (relatedRecordValueMinor && relatedRecordValueMinor > 0) {
    whyItMatters += `The related deal is worth ${(relatedRecordValueMinor / 100).toFixed(2)}. `;
    if (isOverdue) {
      whyItMatters += `Because this task is overdue and the linked deal is high-value, completing it should be treated as high priority to prevent deal stagnation. `;
    }
  }
  if (relatedRecordStage) {
    whyItMatters += `The related record is currently in the ${relatedRecordStage} stage. `;
    if (isOverdue) {
      whyItMatters += `An overdue task at this stage may delay deal progression. `;
    }
  }
  if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 14) {
    whyItMatters += `The related record has had no activity for ${relatedRecordDaysSinceActivity} days, which is a risk signal. `;
    if (isOverdue) {
      whyItMatters += `Completing this overdue task could help re-engage the customer. `;
    }
  } else if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 7) {
    whyItMatters += `The related record last had activity ${relatedRecordDaysSinceActivity} days ago. `;
  }
  if (isOverdue) {
    whyItMatters += `This task is overdue by ${Math.abs(daysOverdue || 0)} days and needs immediate attention. `;
  }
  whyItMatters = whyItMatters.trim() || "Standard task requiring completion.";

  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Complete the task and log the outcome as an activity");
  }

  return {
    id: task.id as string,
    title,
    description: task.description as string | null,
    mode: task.mode as string | null,
    assigneeName: task.assignee_name as string | null,
    dueAt,
    completedAt: completedAt,
    status: status as "open" | "completed" | null,
    relatedRecordName,
    companyName,
    entityType,
    entityId: entityId,
    createdAt: task.created_at as string | null,
    isOverdue: !!isOverdue,
    daysOverdue,
    daysUntilDue,
    relatedRecordStage,
    relatedRecordValueMinor,
    relatedRecordLastActivityAt,
    relatedRecordDaysSinceActivity: relatedRecordDaysSinceActivity,
    relatedRecordOpenDeals,
    priority,
    whyItMatters,
    recommendedNextSteps,
    recommendedAction: (() => { try { return generateTaskActionRecommendation(taskId); } catch { return null; } })(),
    relatedActivitiesSummary,
    evidence,
    evidenceQuality: assessEvidenceQuality(evidence).quality,
    overview: (() => {
      let narrative = whyItMatters;
      if (relatedRecordStage) {
        narrative += ` The related record is currently in the ${relatedRecordStage} stage.`;
      }
      if (isOverdue) {
        narrative += ` This task is overdue by ${Math.abs(daysOverdue || 0)} days, which may impact the related deal or customer relationship.`;
      } else if (daysUntilDue !== null) {
        narrative += ` The task is due in ${daysUntilDue} days.`;
      }
      if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 14) {
        narrative += ` Since the related record has had no activity for ${relatedRecordDaysSinceActivity} days, completing this task could help re-engage the customer.`;
      }
      if (relatedRecordOpenDeals > 0) {
        narrative += ` The linked customer has ${relatedRecordOpenDeals} open deal(s) that may benefit from timely follow-up.`;
      }
      return narrative;
    })(),
  };
}

/* ------------------------------------------------------------------ */
/* Global Analysis                                                     */
/* ------------------------------------------------------------------ */

export function analyzeGlobal(): GlobalAnalysis {
  const db = getDb();

  const todayPriorities: GlobalAnalysis["todayPriorities"] = [];

  const overdueTasks = getOverdueTasksSummary();
  const highValueOverdue = overdueTasks.filter((t) => {
    if (!t.assigneeName) return false;
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT d.expected_value_minor FROM ${TABLES.tasks} tk
             JOIN ${TABLES.deals} d ON d.id = tk.entity_id
             WHERE tk.id = ? AND tk.entity_type = 'deal' AND d.deleted_at IS NULL
             LIMIT 1`
          )
          .get(t.id) as { expected_value_minor: number | null } | undefined,
      undefined
    );
    const dealValue = row?.expected_value_minor ?? null;
    return dealValue !== null && dealValue > 0;
  });

  if (overdueTasks.length > 0) {
    todayPriorities.push({
      type: "overdue_tasks",
      id: "overdue-tasks",
      label: `${overdueTasks.length} overdue task(s)`,
      reason: "Past due date requires immediate attention",
      value: `${highValueOverdue.length} linked to high-value deals`,
    });
  }

  const atRiskDealsQuery = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, e.name AS company, ps.label AS stage, d.expected_value_minor,
                  CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS days_since_update,
                  d.probability_pct
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
           LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
           WHERE d.deleted_at IS NULL
             AND (ps.is_terminal IS NULL OR ps.is_terminal = 0)
             AND (d.updated_at IS NULL OR d.updated_at < date('now', '-14 days')
                  OR d.probability_pct IS NULL OR d.probability_pct < 20)
           ORDER BY days_since_update DESC
            LIMIT 10`
         )
         .all() as Array<{
           id: string;
           name: string | null;
           company: string | null;
           stage: string | null;
           expected_value_minor: number | null;
           days_since_update: number;
           probability_pct: number | null;
         }>
  );
  const uniqueAtRiskDeals = Array.from(
    new Map(atRiskDealsQuery.map((r) => [r.id, r])).values()
  );

  const atRiskDeals: GlobalAnalysis["atRiskDeals"] = uniqueAtRiskDeals.map((r) => {
    const reasons: string[] = [];
    if (r.days_since_update > 14) reasons.push(`No update for ${r.days_since_update} days`);
    if (r.probability_pct === null || r.probability_pct < 20) reasons.push("Low or missing probability");
    return {
      id: r.id,
      name: r.name ?? "",
      company: r.company,
      stage: r.stage,
      expectedValueMinor: r.expected_value_minor,
      riskLevel: reasons.length > 1 ? "high" : "medium",
      reason: reasons.join("; "),
    };
  });

  if (atRiskDeals.length > 0) {
    todayPriorities.push({
      type: "at_risk_deals",
      id: "at-risk-deals",
      label: `${atRiskDeals.length} at-risk deal(s)`,
      reason: "Require attention to prevent loss",
      value: atRiskDeals.slice(0, 3).map((d) => d.name).join(", "),
    });
  }

  const inactiveCustomers = safeAll(
    () =>
      db
        .prepare(
          `SELECT e.id, e.name,
                  MAX(a.occurred_at) AS last_activity_at,
                  CAST(julianday('now') - julianday(MAX(a.occurred_at)) AS INTEGER) AS days_since_activity,
                  COUNT(DISTINCT d.id) AS deal_count
           FROM ${TABLES.customers} e
           LEFT JOIN ${TABLES.leads} l ON l.establishment_id = e.id AND l.deleted_at IS NULL
           LEFT JOIN ${TABLES.deals} d ON d.establishment_id = e.id AND d.deleted_at IS NULL
           LEFT JOIN ${TABLES.activities} a ON (
             (a.entity_type = 'establishment' AND a.entity_id = e.id)
             OR (a.entity_type = 'lead' AND a.entity_id = l.id)
             OR (a.entity_type = 'deal' AND a.entity_id = d.id)
           )
           WHERE e.deleted_at IS NULL
           GROUP BY e.id
           HAVING last_activity_at IS NULL OR days_since_activity > 30
           ORDER BY days_since_activity DESC
            LIMIT 10`
         )
         .all() as Array<{
           id: string;
           name: string | null;
           days_since_activity: number;
           deal_count: number;
         }>
  );
  const uniqueInactiveCustomers = Array.from(
    new Map(inactiveCustomers.map((c) => [c.id, c])).values()
  );

  const customersRequiringAttention: GlobalAnalysis["customersRequiringAttention"] = uniqueInactiveCustomers.map((c) => ({
    id: c.id,
    name: c.name ?? "",
    reason: `No activity for ${c.days_since_activity} days`,
    daysSinceActivity: c.days_since_activity,
    openDeals: c.deal_count,
  }));

  if (customersRequiringAttention.length > 0) {
    todayPriorities.push({
      type: "inactive_customers",
      id: "inactive-customers",
      label: `${customersRequiringAttention.length} inactive customer(s)`,
      reason: "No activity for 30+ days",
      value: customersRequiringAttention.slice(0, 3).map((c) => c.name).join(", "),
    });
  }

  const byAssignee: Record<string, number> = {};
  for (const t of overdueTasks) {
    const name = t.assigneeName || "Unassigned";
    byAssignee[name] = (byAssignee[name] || 0) + 1;
  }

  const overdueTasksSummary: GlobalAnalysis["overdueTasksSummary"] = {
    total: overdueTasks.length,
    byAssignee,
    linkedToHighValueDeals: highValueOverdue.length,
  };

  const followUpOpportunities: GlobalAnalysis["followUpOpportunities"] = [];

  const staleLeads = safeAll(
    () =>
      db
        .prepare(
          `SELECT l.id, l.full_name,
                  MAX(a.occurred_at) AS last_activity
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.activities} a ON (a.entity_type = 'lead' AND a.entity_id = l.id)
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
             AND (l.updated_at IS NULL OR l.updated_at < date('now', '-14 days'))
           GROUP BY l.id
           ORDER BY last_activity ASC
           LIMIT 5`
        )
        .all() as Array<{ id: string; full_name: string | null }>
  );

  staleLeads.forEach((l) => {
    followUpOpportunities.push({
      id: l.id,
      label: l.full_name || l.id,
      reason: "No recent activity — potential follow-up needed",
    });
  });

  const topPerformers = getOwnerPerformanceSummary().slice(0, 5);

  const recentTimelineEvents = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.occurred_at, a.body, u.name AS user_name, at.label AS label
           FROM ${TABLES.activities} a
           LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
           LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
           ORDER BY a.occurred_at DESC
           LIMIT 20`
        )
        .all() as Array<{
          occurred_at: string | null;
          body: string | null;
          user_name: string | null;
          label: string | null;
        }>
  );

  const timelineMap = new Map<string, Array<{ kind: string; body: string; userName: string }>>();
  for (const e of recentTimelineEvents) {
    const date = e.occurred_at?.split("T")[0] || "unknown";
    if (!timelineMap.has(date)) timelineMap.set(date, []);
    timelineMap.get(date)!.push({
      kind: e.label || "Activity",
      body: e.body || "",
      userName: e.user_name || "",
    });
  }

  const timeline: GlobalAnalysis["timeline"] = Array.from(timelineMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([date, events]) => ({ date, events: events.slice(0, 5) }));

  return {
    todayPriorities,
    atRiskDeals,
    customersRequiringAttention,
    overdueTasksSummary,
    followUpOpportunities,
    topPerformers,
    timeline,
  };
}

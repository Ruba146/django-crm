import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EvidenceQuality = "strong" | "medium" | "weak" | "missing";

export interface TemporalWindow {
  label: string;
  startDate: string;
  endDate: string;
  activityCount: number;
  customerActivityCount: number;
  employeeActivityCount: number;
}

export interface TemporalComparison {
  current: TemporalWindow;
  previous: TemporalWindow | null;
  activityChange: number | null;
  activityChangePct: number | null;
  customerActivityChange: number | null;
  employeeActivityChange: number | null;
  trend: "increasing" | "decreasing" | "stable" | "unknown";
  customerTrend: "increasing" | "decreasing" | "stable" | "unknown";
  employeeTrend: "increasing" | "decreasing" | "stable" | "unknown";
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

export interface ChangeDetection {
  hasChange: boolean;
  changes: Array<{
    type: string;
    previousState: string | null;
    currentState: string | null;
    change: string;
    significance: "high" | "medium" | "low";
    evidence: string[];
  }>;
  summary: string;
  confidence: "high" | "medium" | "low";
}

export interface BehavioralPattern {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}

export interface EvidenceAssessment {
  quality: EvidenceQuality;
  strongCount: number;
  mediumCount: number;
  weakCount: number;
  missingCount: number;
  totalRelevant: number;
  summary: string;
}

export interface ContradictionResult {
  hasContradiction: boolean;
  contradictions: string[];
  warnings: string[];
}

export interface CrossEntityContext {
  customerId: string;
  activeDeals: number;
  activeLeads: number;
  totalPipelineMinor: number;
  totalActivities: number;
  customerActivities: number;
  employeeActivities: number;
  overdueTasks: number;
  openTasks: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  dealSummary: Array<{
    id: string;
    name: string;
    stage: string | null;
    status: string | null;
    expectedValueMinor: number | null;
    daysSinceLastActivity: number | null;
    daysInStage: number | null;
  }>;
  leadSummary: Array<{
    id: string;
    fullName: string;
    stage: string | null;
    daysSinceLastActivity: number | null;
  }>;
  relationshipInsights: string[];
}

export interface StageHistoricalContext {
  stageId: string | null;
  stageLabel: string | null;
  typicalDuration: number | null;
  conversionRate: number | null;
  lossRate: number | null;
  comparableDeals: number;
  confidence: "high" | "medium" | "low";
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

function classifyEvidenceQuality(statement: string): EvidenceQuality {
  const lower = statement.toLowerCase();
  const strongPatterns = [
    "recorded", "activity", "interactions", "days", "date", "timestamp",
    "crm probability", "historical", "comparable", "overdue", "stalled",
    "won", "lost", "stage", "conversion", "no activity", "inactive"
  ];
  const mediumPatterns = [
    "trend", "pattern", "frequency", "engagement", "suggests", "indicates",
    "compared", "previous", "recent", "declining", "increasing"
  ];
  const weakPatterns = [
    "may", "might", "possibly", "potentially", "could", "appears",
    "seems", "unclear", "limited", "sparse"
  ];

  if (strongPatterns.some(p => lower.includes(p)) && !weakPatterns.some(p => lower.includes(p))) return "strong";
  if (mediumPatterns.some(p => lower.includes(p)) && !weakPatterns.some(p => lower.includes(p))) return "medium";
  if (weakPatterns.some(p => lower.includes(p))) return "weak";
  return "medium";
}

export function assessEvidenceQuality(evidence: string[]): EvidenceAssessment {
  if (evidence.length === 0) {
    return {
      quality: "missing",
      strongCount: 0,
      mediumCount: 0,
      weakCount: 0,
      missingCount: 1,
      totalRelevant: 0,
      summary: "No evidence available — conclusions cannot be reliably supported.",
    };
  }

  let strongCount = 0;
  let mediumCount = 0;
  let weakCount = 0;
  let missingCount = 0;

  for (const e of evidence) {
    const quality = classifyEvidenceQuality(e);
    if (quality === "strong") strongCount++;
    else if (quality === "medium") mediumCount++;
    else if (quality === "weak") weakCount++;
    else missingCount++;
  }

  const totalRelevant = evidence.length;
  const strongRatio = strongCount / totalRelevant;
  const weakRatio = weakCount / totalRelevant;

  let quality: EvidenceQuality;
  if (strongRatio >= 0.5 && weakRatio < 0.2) quality = "strong";
  else if (strongRatio >= 0.3 || (mediumCount > 0 && weakRatio < 0.3)) quality = "medium";
  else if (weakRatio >= 0.5) quality = "weak";
  else quality = "medium";

  let summary: string;
  if (quality === "strong") summary = `Analysis is well-supported by ${strongCount} strong evidence points.`;
  else if (quality === "medium") summary = `Analysis has ${strongCount} strong and ${mediumCount} moderate evidence points. Some conclusions are inferential.`;
  else if (quality === "weak") summary = `Evidence is mostly inferential (${weakCount} weak signals). Conclusions should be treated cautiously.`;
  else summary = "Evidence quality is insufficient for reliable conclusions.";

  return { quality, strongCount, mediumCount, weakCount, missingCount, totalRelevant, summary };
}

export function confidenceFromEvidence(evidence: string[], minRequired = 3): "high" | "medium" | "low" {
  if (evidence.length === 0) return "low";
  const assessment = assessEvidenceQuality(evidence);
  if (assessment.quality === "strong" && evidence.length >= minRequired + 2) return "high";
  if (assessment.quality === "strong" && evidence.length >= minRequired) return "high";
  if (assessment.quality === "medium" && evidence.length >= minRequired) return "medium";
  if (evidence.length >= minRequired) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Temporal Analysis                                                   */
/* ------------------------------------------------------------------ */

export function analyzeTemporalBehavior(
  entityType: "deal" | "lead" | "customer" | "establishment",
  entityId: string
): TemporalComparison {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const activities = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.occurred_at, a.user_id, a.entity_type, a.direction
           FROM ${TABLES.activities} a
           WHERE a.entity_type = ? AND a.entity_id = ?
           ORDER BY a.occurred_at DESC`
        )
        .all(entityType, entityId) as Array<{
          occurred_at: string;
          user_id: string | null;
          entity_type: string | null;
          direction: string | null;
        }>
  );

  function buildWindow(days: number): TemporalWindow {
    const endDate = today;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const windowActivities = activities.filter(a => {
      const d = a.occurred_at?.split("T")[0] || "";
      return d >= startDate && d <= endDate;
    });
    const customerActs = windowActivities.filter(a => a.direction === "inbound" || a.user_id === entityId).length;
    const employeeActs = windowActivities.length - customerActs;
    return {
      label: `Last ${days} days`,
      startDate,
      endDate,
      activityCount: windowActivities.length,
      customerActivityCount: customerActs,
      employeeActivityCount: employeeActs,
    };
  }

  const current7 = buildWindow(7);
  const previous7 = buildWindow(14);
  const previous7Filtered: TemporalWindow = {
    ...previous7,
    activityCount: previous7.activityCount - current7.activityCount,
    customerActivityCount: previous7.customerActivityCount - current7.customerActivityCount,
    employeeActivityCount: previous7.employeeActivityCount - current7.employeeActivityCount,
  };

  const current14 = buildWindow(14);
  const previous14 = buildWindow(28);
  const previous14Filtered: TemporalWindow = {
    ...previous14,
    activityCount: previous14.activityCount - current14.activityCount,
    customerActivityCount: previous14.customerActivityCount - current14.customerActivityCount,
    employeeActivityCount: previous14.employeeActivityCount - current14.employeeActivityCount,
  };

  const current30 = buildWindow(30);
  const previous30 = buildWindow(60);
  const previous30Filtered: TemporalWindow = {
    ...previous30,
    activityCount: previous30.activityCount - current30.activityCount,
    customerActivityCount: previous30.customerActivityCount - current30.customerActivityCount,
    employeeActivityCount: previous30.employeeActivityCount - current30.employeeActivityCount,
  };

  function computeTrend(curr: TemporalWindow, prev: TemporalWindow | null): "increasing" | "decreasing" | "stable" | "unknown" {
    if (!prev || curr.activityCount === 0 && prev.activityCount === 0) return "unknown";
    if (curr.activityCount === 0 && prev.activityCount > 0) return "decreasing";
    if (prev.activityCount === 0 && curr.activityCount > 0) return "increasing";
    const change = curr.activityCount - prev.activityCount;
    const pct = prev.activityCount > 0 ? (Math.abs(change) / prev.activityCount) * 100 : 0;
    if (change > 0 && pct >= 15) return "increasing";
    if (change < 0 && pct >= 15) return "decreasing";
    return "stable";
  }

  const trend7 = computeTrend(current7, previous7Filtered);
  const trend14 = computeTrend(current14, previous14Filtered);
  const trend30 = computeTrend(current30, previous30Filtered);

  const evidence: string[] = [];
  if (current7.activityCount > 0 || previous7Filtered.activityCount > 0) {
    evidence.push(
      `7-day activity: ${current7.activityCount} (current) vs ${previous7Filtered.activityCount} (previous) — ${trend7}`
    );
  }
  if (current14.activityCount > 0 || previous14Filtered.activityCount > 0) {
    evidence.push(
      `14-day activity: ${current14.activityCount} (current) vs ${previous14Filtered.activityCount} (previous) — ${trend14}`
    );
  }
  if (current30.activityCount > 0 || previous30Filtered.activityCount > 0) {
    evidence.push(
      `30-day activity: ${current30.activityCount} (current) vs ${previous30Filtered.activityCount} (previous) — ${trend30}`
    );
  }

  const customerTrend7 = computeCustomerTrend(current7, previous7Filtered);
  const employeeTrend7 = computeEmployeeTrend(current7, previous7Filtered);
  evidence.push(`Customer-initiated activity trend (7d): ${customerTrend7}`);
  evidence.push(`Employee-initiated activity trend (7d): ${employeeTrend7}`);

  const overallTrend = trend14 === "increasing" || trend7 === "increasing" ? "increasing"
    : trend14 === "decreasing" || trend7 === "decreasing" ? "decreasing"
    : "stable";

  const confidence = activities.length >= 10 ? "high"
    : activities.length >= 5 ? "medium"
    : "low";

  return {
    current: current30,
    previous: previous30Filtered,
    activityChange: current30.activityCount - previous30Filtered.activityCount,
    activityChangePct: previous30Filtered.activityCount > 0
      ? Math.round(((current30.activityCount - previous30Filtered.activityCount) / previous30Filtered.activityCount) * 100)
      : null,
    customerActivityChange: current30.customerActivityCount - previous30Filtered.customerActivityCount,
    employeeActivityChange: current30.employeeActivityCount - previous30Filtered.employeeActivityCount,
    trend: overallTrend,
    customerTrend: customerTrend7,
    employeeTrend: employeeTrend7,
    evidence,
    confidence,
  };
}

function computeCustomerTrend(curr: TemporalWindow, prev: TemporalWindow): "increasing" | "decreasing" | "stable" | "unknown" {
  if (!prev || (curr.customerActivityCount === 0 && prev.customerActivityCount === 0)) return "unknown";
  if (curr.customerActivityCount === 0 && prev.customerActivityCount > 0) return "decreasing";
  if (prev.customerActivityCount === 0 && curr.customerActivityCount > 0) return "increasing";
  const change = curr.customerActivityCount - prev.customerActivityCount;
  const pct = prev.customerActivityCount > 0 ? (Math.abs(change) / prev.customerActivityCount) * 100 : 0;
  if (change > 0 && pct >= 20) return "increasing";
  if (change < 0 && pct >= 20) return "decreasing";
  return "stable";
}

function computeEmployeeTrend(curr: TemporalWindow, prev: TemporalWindow): "increasing" | "decreasing" | "stable" | "unknown" {
  if (!prev || (curr.employeeActivityCount === 0 && prev.employeeActivityCount === 0)) return "unknown";
  if (curr.employeeActivityCount === 0 && prev.employeeActivityCount > 0) return "decreasing";
  if (prev.employeeActivityCount === 0 && curr.employeeActivityCount > 0) return "increasing";
  const change = curr.employeeActivityCount - prev.employeeActivityCount;
  const pct = prev.employeeActivityCount > 0 ? (Math.abs(change) / prev.employeeActivityCount) * 100 : 0;
  if (change > 0 && pct >= 20) return "increasing";
  if (change < 0 && pct >= 20) return "decreasing";
  return "stable";
}

/* ------------------------------------------------------------------ */
/* Change Detection                                                    */
/* ------------------------------------------------------------------ */

export function detectChanges(
  entityType: "deal" | "lead" | "customer" | "establishment",
  entityId: string
): ChangeDetection {
  const db = getDb();
  const changes: ChangeDetection["changes"] = [];
  const now = new Date().toISOString().split("T")[0];

  if (entityType === "deal") {
    const deal = safeGet(
      () =>
        db
          .prepare(
            `SELECT d.*, s.label AS stage_label, s.terminal_type
             FROM ${TABLES.deals} d
             LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
             WHERE d.id = ? AND d.deleted_at IS NULL
             LIMIT 1`
          )
          .get(entityId) as Record<string, unknown> | undefined,
      undefined
    );

    if (deal) {
      const activityCount = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      const lastActivity = safeGet(
        () =>
          db
            .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
            .get(entityId) as { last: string | null },
        { last: null }
      ).last;

      const daysSinceActivity = lastActivity ? daysBetween(lastActivity, now) : null;

      if (daysSinceActivity !== null && daysSinceActivity > 14) {
        const significance: ChangeDetection["changes"][0]["significance"] = daysSinceActivity > 30 ? "high" : "medium";
        changes.push({
          type: "activity_decrease",
          previousState: "Active engagement",
          currentState: `No activity for ${daysSinceActivity} days`,
          change: `Customer activity has decreased significantly — last interaction was ${daysSinceActivity} days ago`,
          significance,
          evidence: [`Last activity: ${lastActivity}`, `Total activities: ${activityCount}`],
        });
      }

      const stageLabel = deal.stage_label as string | null;
      if (stageLabel && activityCount > 5) {
        const hasProgression = safeGet(
          () =>
            db
              .prepare(
                `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
                 WHERE a.entity_type = 'deal' AND a.entity_id = ?
                 AND (a.body LIKE '%proposal%' OR a.body LIKE '%negotiation%' OR a.body LIKE '%stage%')`
              )
              .get(entityId) as { c: number },
          { c: 0 }
        ).c > 0;

        if (!hasProgression && activityCount > 5) {
          changes.push({
            type: "activity_without_progression",
            previousState: "Active deal",
            currentState: `${activityCount} activities but no stage advancement`,
            change: "Many activities recorded but deal remains in the same stage",
            significance: "medium",
            evidence: [`${activityCount} activities without stage progression`, `Current stage: ${stageLabel}`],
          });
        }
      }

      const overdueTaskCount = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      if (overdueTaskCount > 0) {
        changes.push({
          type: "task_overdue",
          previousState: "All tasks on track",
          currentState: `${overdueTaskCount} overdue task(s)`,
          change: `${overdueTaskCount} follow-up task(s) have become overdue, indicating incomplete commitments`,
          significance: overdueTaskCount > 2 ? "high" : "medium",
          evidence: [`${overdueTaskCount} overdue tasks`],
        });
      }

      const terminalType = deal.terminal_type as string | null;
      if (terminalType === "won") {
        changes.push({
          type: "deal_won",
          previousState: "Active opportunity",
          currentState: "Won",
          change: "Deal has been closed successfully",
          significance: "high",
          evidence: [`Stage: ${stageLabel}`, `Won value: ${(deal.won_value_minor as number | null ?? 0) / 100} SAR`],
        });
      } else if (terminalType === "lost") {
        changes.push({
          type: "deal_lost",
          previousState: "Active opportunity",
          currentState: "Lost",
          change: "Deal has been lost",
          significance: "high",
          evidence: [`Stage: ${stageLabel}`, `Lost reason recorded`],
        });
      }
    }
  }

  if (entityType === "customer" || entityType === "establishment") {
    const customerDeals = safeAll(
      () =>
        db
          .prepare(
            `SELECT d.id, d.stage_id, d.probability_pct, d.updated_at, d.created_at,
                    s.label AS stage_label, s.terminal_type
             FROM ${TABLES.deals} d
             LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
             WHERE d.establishment_id = ? AND d.deleted_at IS NULL
             ORDER BY d.updated_at DESC`
          )
          .all(entityId) as Array<{
            id: string;
            stage_id: string | null;
            probability_pct: number | null;
            updated_at: string | null;
            created_at: string | null;
            stage_label: string | null;
            terminal_type: string | null;
          }>
    );

    if (customerDeals.length > 0) {
      const recentDeals = customerDeals.filter(d => d.updated_at && daysBetween(d.updated_at, now) !== null && daysBetween(d.updated_at, now)! <= 14);
      const staleDeals = customerDeals.filter(d => !d.updated_at || (daysBetween(d.updated_at, now) !== null && daysBetween(d.updated_at, now)! > 14));
      if (staleDeals.length > 0 && recentDeals.length === 0) {
        changes.push({
          type: "activity_stop",
          previousState: `${recentDeals.length} recently active deals`,
          currentState: `${staleDeals.length} deals with no recent updates`,
          change: `All ${staleDeals.length} active deal(s) have had no updates in the last 14 days`,
          significance: "high",
          evidence: staleDeals.map(d => `Deal ${d.id || d.stage_label || "unknown"}: last updated ${d.updated_at || "never"}`),
        });
      }

      const wonDeals = customerDeals.filter(d => d.terminal_type === "won");
      const lostDeals = customerDeals.filter(d => d.terminal_type === "lost");
      if (wonDeals.length > 0) {
        changes.push({
          type: "outcome_change",
          previousState: "Active opportunity",
          currentState: "Won",
          change: `${wonDeals.length} deal(s) closed successfully`,
          significance: "high",
          evidence: wonDeals.map(d => `Deal won: ${d.stage_label || "closed"}`),
        });
      }
      if (lostDeals.length > 0) {
        changes.push({
          type: "outcome_change",
          previousState: "Active opportunity",
          currentState: "Lost",
          change: `${lostDeals.length} deal(s) lost`,
          significance: "high",
          evidence: lostDeals.map(d => `Deal lost: ${d.stage_label || "closed"}`),
        });
      }
    }
  }

  if (entityType === "lead") {
    const lead = safeGet(
      () =>
        db
          .prepare(
            `SELECT l.*, s.label AS stage_label
             FROM ${TABLES.leads} l
             LEFT JOIN ${TABLES.stages} s ON s.id = l.stage_id
             WHERE l.id = ? AND l.deleted_at IS NULL
             LIMIT 1`
          )
          .get(entityId) as Record<string, unknown> | undefined,
      undefined
    );

    if (lead) {
      const stageLabel = lead.stage_label as string | null;
      const activityCount = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      const lastActivity = safeGet(
        () =>
          db
            .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`)
            .get(entityId) as { last: string | null },
        { last: null }
      ).last;

      const daysSinceActivity = lastActivity ? daysBetween(lastActivity, now) : null;

      if (daysSinceActivity !== null && daysSinceActivity > 14) {
        changes.push({
          type: "activity_decrease",
          previousState: "Active engagement",
          currentState: `No activity for ${daysSinceActivity} days`,
          change: `Lead activity has decreased — last interaction was ${daysSinceActivity} days ago`,
          significance: daysSinceActivity > 30 ? "high" : "medium",
          evidence: [`Last activity: ${lastActivity}`, `Total activities: ${activityCount}`],
        });
      }

      const openDeals = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE lead_id = ? AND deleted_at IS NULL AND (status IS NULL OR status = '')`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      if (openDeals > 0 && stageLabel !== "lost" && stageLabel !== "junk") {
        changes.push({
          type: "lead_converted",
          previousState: "Lead",
          currentState: `${openDeals} open deal(s)`,
          change: `Lead has been converted to ${openDeals} open deal(s)`,
          significance: "high",
          evidence: [`Open deals: ${openDeals}`, `Stage: ${stageLabel}`],
        });
      }
    }
  }

  const hasChange = changes.length > 0;
  const summary = hasChange
    ? changes.map(c => c.change).join(". ")
    : "No significant change detected.";

  const confidence = changes.length > 2 ? "high"
    : changes.length > 0 ? "medium"
    : "low";

  return { hasChange, changes, summary, confidence };
}

/* ------------------------------------------------------------------ */
/* Behavioral Pattern Detection                                          */
/* ------------------------------------------------------------------ */

export function detectBehavioralPatterns(
  entityType: "deal" | "lead" | "customer" | "establishment",
  entityId: string
): BehavioralPattern[] {
  const db = getDb();
  const patterns: BehavioralPattern[] = [];
  const now = new Date().toISOString().split("T")[0];

  if (entityType === "customer" || entityType === "establishment") {
    const dealRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT d.id, d.expected_value_minor, d.updated_at, d.stage_id,
                    s.label AS stage_label, s.terminal_type
             FROM ${TABLES.deals} d
             LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
             WHERE d.establishment_id = ? AND d.deleted_at IS NULL`
          )
          .all(entityId) as Array<{
            id: string;
            expected_value_minor: number | null;
            updated_at: string | null;
            stage_id: string | null;
            stage_label: string | null;
            terminal_type: string | null;
          }>
    );

    const activeDeals = dealRows.filter(d => !d.terminal_type);

    const allActivities = safeAll(
      () =>
        db
          .prepare(
            `SELECT a.occurred_at, a.direction, a.user_id
             FROM ${TABLES.activities} a
             WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
                OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))
             ORDER BY a.occurred_at DESC`
          )
          .all(entityId, entityId) as Array<{ occurred_at: string; direction: string | null; user_id: string | null }>
    );

    const recentActivities = allActivities.filter(a => {
      if (!a.occurred_at) return false;
      const d = new Date(a.occurred_at);
      return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 14;
    });

    if (activeDeals.length >= 2 && recentActivities.length === 0) {
      const totalValue = activeDeals.reduce((s, d) => s + (d.expected_value_minor || 0), 0);
      patterns.push({
        type: "multi_opportunity_inactivity",
        severity: "critical",
        title: `${activeDeals.length} active opportunities with no recent activity`,
        description: `Customer has ${activeDeals.length} open deals worth ${(totalValue / 100).toFixed(2)} SAR but no activity in 14+ days. Multiple opportunities are at risk simultaneously.`,
        evidence: [
          `${activeDeals.length} active deals`,
          `Pipeline value: ${(totalValue / 100).toFixed(2)} SAR`,
          `No activity in last 14 days`,
          ...activeDeals.slice(0, 3).map(d => `Deal: ${d.stage_label || "unknown stage"}`),
        ],
        confidence: recentActivities.length === 0 ? "high" : "medium",
      });
    }

    const staleHighValue = activeDeals.filter(d => {
      const daysSinceUpdate = d.updated_at ? daysBetween(d.updated_at, now) : null;
      return daysSinceUpdate !== null && daysSinceUpdate > 14 && d.expected_value_minor && d.expected_value_minor > 200000;
    });
    if (staleHighValue.length > 0) {
      patterns.push({
        type: "silent_high_value_opportunity",
        severity: "critical",
        title: `${staleHighValue.length} high-value deal(s) going silent`,
        description: "High-value opportunities have had no recent activity, representing significant revenue risk.",
        evidence: staleHighValue.map(d => `${d.stage_label || "unknown"}: ${(d.expected_value_minor! / 100).toFixed(2)} SAR`),
        confidence: "high",
      });
    }

    const inactiveTasks = safeGet(
      () =>
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
             WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
                OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
               AND t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now')`
          )
          .get(entityId, entityId) as { c: number },
      { c: 0 }
    ).c;

    if (inactiveTasks >= 2 && recentActivities.length <= 1) {
      patterns.push({
        type: "repeated_followup_failure",
        severity: "warning",
        title: `Multiple overdue tasks with no customer response`,
        description: `${inactiveTasks} follow-up tasks are overdue and the customer has not responded recently, indicating repeated follow-up failures.`,
        evidence: [`${inactiveTasks} overdue tasks`, `Only ${recentActivities.length} recent activities`],
        confidence: "high",
      });
    }
  }

  if (entityType === "deal") {
    const deal = safeGet(
      () =>
        db
          .prepare(
            `SELECT d.*, s.label AS stage_label, s.terminal_type, s.sort_order
             FROM ${TABLES.deals} d
             LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
             WHERE d.id = ? AND d.deleted_at IS NULL
             LIMIT 1`
          )
          .get(entityId) as Record<string, unknown> | undefined,
      undefined
    );

    if (deal) {
      const stageLabel = deal.stage_label as string | null;
      const daysSinceUpdate = deal.updated_at ? daysBetween(deal.updated_at as string, now) : null;

      if (stageLabel && daysSinceUpdate !== null && daysSinceUpdate > 21) {
        const isLateStage = stageLabel === "Negotiation" || stageLabel === "Proposal" || stageLabel === "Demo";
        patterns.push({
          type: isLateStage ? "late_stage_stagnation" : "activity_without_progression",
          severity: isLateStage ? "critical" : "warning",
          title: isLateStage ? `Deal stuck in ${stageLabel} for ${daysSinceUpdate} days` : `No progression in ${stageLabel} for ${daysSinceUpdate} days`,
          description: isLateStage
            ? `Deal reached ${stageLabel} but has remained there for ${daysSinceUpdate} days without advancement. Late-stage deals require timely closure.`
            : `Deal has been in ${stageLabel} for ${daysSinceUpdate} days without moving forward.`,
          evidence: [
            `Stage: ${stageLabel}`,
            `Days in stage: ${daysSinceUpdate}`,
            `Last updated: ${deal.updated_at}`,
          ],
          confidence: daysSinceUpdate > 30 ? "high" : "medium",
        });
      }

      const activities = safeAll(
        () =>
          db
            .prepare(`SELECT occurred_at, direction FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ? ORDER BY occurred_at DESC LIMIT 10`)
            .all(entityId) as Array<{ occurred_at: string; direction: string | null }>
      );

      if (activities.length >= 3) {
        const inboundCount = activities.filter(a => a.direction === "inbound").length;
        const outboundCount = activities.filter(a => a.direction === "outbound" || !a.direction).length;
        if (outboundCount >= 3 && inboundCount === 0) {
          patterns.push({
            type: "repeated_followup_failure",
            severity: "warning",
            title: "Multiple outbound touches without customer response",
            description: `${outboundCount} outbound activities with no inbound customer response — follow-up strategy may need adjustment.`,
            evidence: [`${outboundCount} outbound activities`, `${inboundCount} inbound responses`, "No customer-initiated contact"],
            confidence: "medium",
          });
        }

        const recentActivityDates = activities.slice(0, 5).map(a => new Date(a.occurred_at).getTime());
        if (recentActivityDates.length >= 2) {
          const gaps = [];
          for (let i = 0; i < recentActivityDates.length - 1; i++) {
            const gapDays = Math.floor((recentActivityDates[i] - recentActivityDates[i + 1]) / (1000 * 60 * 60 * 24));
            gaps.push(gapDays);
          }
          const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const latestGap = gaps[0];

          if (latestGap > avgGap * 2 && latestGap > 14) {
            patterns.push({
              type: "sudden_activity_drop",
              severity: "warning",
              title: `Sudden activity drop detected (${latestGap} days since last contact)`,
              description: `Activity was previously more frequent (avg gap: ${Math.round(avgGap)} days) but the latest gap is ${latestGap} days, indicating a sudden drop in engagement.`,
              evidence: [`Current gap: ${latestGap} days`, `Historical avg gap: ${Math.round(avgGap)} days`, `${activities.length} total recent activities`],
              confidence: "medium",
            });
          }
        }
      }

      if (stageLabel === "Proposal" || stageLabel === "Negotiation") {
        const hasFollowUpTask = safeGet(
          () =>
            db
              .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
              .get(entityId) as { c: number },
          { c: 0 }
        ).c > 0;

        if (!hasFollowUpTask && daysSinceUpdate && daysSinceUpdate > 7) {
          patterns.push({
            type: "proposal_without_followup",
            severity: "warning",
            title: `Proposal-stage deal without follow-up for ${daysSinceUpdate} days`,
            description: `The deal is in ${stageLabel} stage but has no pending follow-up task and hasn't been updated in ${daysSinceUpdate} days. Proposal-stage deals require timely follow-up.`,
            evidence: [`Stage: ${stageLabel}`, `Days since update: ${daysSinceUpdate}`, "No active follow-up task"],
            confidence: "medium",
          });
        }
      }

      const hasRecentMeeting = safeAll(
        () =>
          db
            .prepare(`SELECT a.occurred_at FROM ${TABLES.activities} a LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id WHERE a.entity_type = 'deal' AND a.entity_id = ? AND (at.label LIKE '%meeting%' OR at.label LIKE '%demo%') ORDER BY a.occurred_at DESC LIMIT 1`)
            .all(entityId) as Array<{ occurred_at: string }>
      );

      if (hasRecentMeeting.length > 0) {
        const meetingDate = new Date(hasRecentMeeting[0].occurred_at);
        const daysSinceMeeting = Math.floor((Date.now() - meetingDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceMeeting > 5) {
          const hasNextStepTask = safeGet(
            () =>
              db
                .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at >= date('now')`)
                .get(entityId) as { c: number },
            { c: 0 }
          ).c > 0;

          if (!hasNextStepTask) {
            patterns.push({
              type: "meeting_without_next_step",
              severity: "warning",
              title: "Meeting occurred but no next step scheduled",
              description: `A meeting or demo took place ${daysSinceMeeting} days ago, but no follow-up task or next step has been scheduled. This often leads to deal stagnation after meetings.`,
              evidence: [`Last meeting: ${daysSinceMeeting} days ago`, "No upcoming follow-up task"],
              confidence: "medium",
            });
          }
        }
      }

      const completedTasks = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NOT NULL`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      const overdueTasks = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      if (completedTasks >= 3 && overdueTasks >= 2) {
        patterns.push({
          type: "repeated_overdue_tasks",
          severity: "warning",
          title: `High task completion but recurring overdue tasks`,
          description: `${completedTasks} tasks have been completed, but ${overdueTasks} are currently overdue. This suggests inconsistent follow-up discipline despite overall activity.`,
          evidence: [`${completedTasks} completed tasks`, `${overdueTasks} overdue tasks`],
          confidence: "medium",
        });
      }

      const totalActivitiesForDeal = safeGet(
        () =>
          db
            .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
            .get(entityId) as { c: number },
        { c: 0 }
      ).c;

      if (totalActivitiesForDeal >= 8 && (!stageLabel || stageLabel === "New" || stageLabel === "Qualified")) {
        patterns.push({
          type: "high_activity_low_conversion",
          severity: "warning",
          title: `High activity without stage advancement`,
          description: `${totalActivitiesForDeal} activities recorded but the deal remains in ${stageLabel || "early"} stage. High activity without progression may indicate qualification issues or unclear next steps.`,
          evidence: [`${totalActivitiesForDeal} activities`, `Stage: ${stageLabel || "early"}`],
          confidence: "medium",
        });
      }

      const stageChanges = safeAll(
        () =>
          db
            .prepare(`SELECT created_at FROM ${TABLES.audit_log} WHERE entity_type = 'deal' AND entity_id = ? AND action = 'stage_change' ORDER BY created_at DESC LIMIT 10`)
            .all(entityId) as Array<{ created_at: string }>
      );

      if (stageChanges.length >= 3) {
        const recentChanges = stageChanges.filter(s => {
          const d = new Date(s.created_at);
          return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
        });

        if (recentChanges.length >= 2) {
          patterns.push({
            type: "frequent_stage_changes",
            severity: "info",
            title: `Frequent stage changes (${recentChanges.length} in last 30 days)`,
            description: `The deal has changed stages ${recentChanges.length} times in the past 30 days. Frequent stage changes may indicate uncertainty or qualification issues.`,
            evidence: [`${recentChanges.length} stage changes in 30 days`, `Total changes: ${stageChanges.length}`],
            confidence: "medium",
          });
        }
      }
    }
  }

  if (entityType === "lead") {
    const lead = safeGet(
      () =>
        db
          .prepare(
            `SELECT l.*, s.label AS stage_label
             FROM ${TABLES.leads} l
             LEFT JOIN ${TABLES.stages} s ON s.id = l.stage_id
             WHERE l.id = ? AND l.deleted_at IS NULL
             LIMIT 1`
          )
          .get(entityId) as Record<string, unknown> | undefined,
      undefined
    );

    if (lead) {
      const ageDays = lead.created_at ? daysBetween(lead.created_at as string, now) : null;
      const stageLabel = lead.stage_label as string | null;
      const lastActivity = safeGet(
        () =>
          db
            .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`)
            .get(entityId) as { last: string | null },
        { last: null }
      ).last;
      const daysSinceActivity = lastActivity ? daysBetween(lastActivity, now) : null;

      if (ageDays !== null && ageDays > 30 && (!stageLabel || stageLabel === "New") && daysSinceActivity !== null && daysSinceActivity > 14) {
        patterns.push({
          type: "lead_aging",
          severity: "warning",
          title: `Lead aging without progression (${ageDays} days)`,
          description: `Lead has been in the pipeline for ${ageDays} days without advancing from ${stageLabel || "unknown"} stage.`,
          evidence: [`Age: ${ageDays} days`, `Stage: ${stageLabel || "unknown"}`, `No activity for ${daysSinceActivity} days`],
          confidence: "high",
        });
      }
    }
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Cross-Entity Relationship Intelligence                               */
/* ------------------------------------------------------------------ */

export function getCrossEntityContext(customerId: string): CrossEntityContext | null {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const customer = safeGet(
    () =>
      db
        .prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
        .get(customerId) as { name: string | null } | undefined,
    undefined
  );
  if (!customer) return null;

  const dealRows = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, d.expected_value_minor, d.updated_at, d.stage_id,
                  s.label AS stage_label, s.terminal_type,
                  CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS days_since_update
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.establishment_id = ? AND d.deleted_at IS NULL`
        )
        .all(customerId) as Array<{
          id: string;
          name: string | null;
          expected_value_minor: number | null;
          updated_at: string | null;
          stage_id: string | null;
          stage_label: string | null;
          terminal_type: string | null;
          days_since_update: number | null;
        }>
  );

  const leadRows = safeAll(
    () =>
      db
        .prepare(
          `SELECT l.id, l.full_name, l.updated_at, l.stage_id,
                  s.label AS stage_label,
                  CAST(julianday('now') - julianday(COALESCE(l.updated_at, l.created_at)) AS INTEGER) AS days_since_update
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.stages} s ON s.id = l.stage_id
           WHERE l.establishment_id = ? AND l.deleted_at IS NULL AND l.merged_into_id IS NULL`
        )
        .all(customerId) as Array<{
          id: string;
          full_name: string | null;
          updated_at: string | null;
          stage_id: string | null;
          stage_label: string | null;
          days_since_update: number | null;
        }>
  );

  const activeDeals = dealRows.filter(d => !d.terminal_type);
  const totalPipelineMinor = activeDeals.reduce((s, d) => s + (d.expected_value_minor || 0), 0);

  const lastActivity = safeGet(
    () =>
      db
        .prepare(
          `SELECT MAX(a.occurred_at) AS last FROM ${TABLES.activities} a
           WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))`
        )
        .get(customerId, customerId, customerId) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))`
        )
        .get(customerId, customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const customerActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE a.entity_type = 'establishment' AND a.entity_id = ?`
        )
        .get(customerId) as { c: number },
    { c: 0 }
  ).c;

  const employeeActivities = totalActivities - customerActivities;

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

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
           WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
             AND t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now')`
        )
        .get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const relationshipInsights: string[] = [];
  if (activeDeals.length >= 2) {
    relationshipInsights.push(`Customer has ${activeDeals.length} active opportunities`);
  }
  if (totalPipelineMinor > 0) {
    relationshipInsights.push(`Total pipeline value: ${(totalPipelineMinor / 100).toFixed(2)} SAR`);
  }
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    relationshipInsights.push(`Customer activity declining — last interaction ${daysSinceLastActivity} days ago`);
  }
  if (overdueTasks > 0) {
    relationshipInsights.push(`${overdueTasks} overdue follow-up tasks`);
  }
  if (employeeActivities > customerActivities && customerActivities === 0) {
    relationshipInsights.push("Employee activity exists but no direct customer engagement — one-sided relationship");
  }

  return {
    customerId,
    activeDeals: activeDeals.length,
    activeLeads: leadRows.filter(l => !l.stage_label || l.stage_label === "New" || l.stage_label === "Qualified").length,
    totalPipelineMinor,
    totalActivities,
    customerActivities,
    employeeActivities,
    overdueTasks,
    openTasks,
    lastActivityAt: lastActivity,
    daysSinceLastActivity,
    dealSummary: activeDeals.slice(0, 5).map(d => ({
      id: d.id,
      name: d.name ?? "",
      stage: d.stage_label,
      status: d.terminal_type,
      expectedValueMinor: d.expected_value_minor,
      daysSinceLastActivity: d.updated_at ? daysBetween(d.updated_at, now) : null,
      daysInStage: d.days_since_update,
    })),
    leadSummary: leadRows.slice(0, 5).map(l => ({
      id: l.id,
      fullName: l.full_name ?? "",
      stage: l.stage_label,
      daysSinceLastActivity: l.updated_at ? daysBetween(l.updated_at, now) : null,
    })),
    relationshipInsights,
  };
}

/* ------------------------------------------------------------------ */
/* Stage Historical Context                                             */
/* ------------------------------------------------------------------ */

export function getStageHistoricalContext(stageId: string | null, expectedValueMinor: number | null): StageHistoricalContext {
  const db = getDb();
  if (!stageId) {
    return {
      stageId: null,
      stageLabel: null,
      typicalDuration: null,
      conversionRate: null,
      lossRate: null,
      comparableDeals: 0,
      confidence: "low",
    };
  }

  const stage = safeGet(
    () =>
      db
        .prepare(`SELECT label, is_terminal, terminal_type FROM ${TABLES.stages} WHERE id = ? LIMIT 1`)
        .get(stageId) as { label: string | null; is_terminal: number | null; terminal_type: string | null } | undefined,
    undefined
  );

  const valueRangeLow = expectedValueMinor ? Math.max(0, expectedValueMinor - (expectedValueMinor * 0.3)) : 0;
  const valueRangeHigh = expectedValueMinor ? expectedValueMinor + (expectedValueMinor * 0.3) : 999999999;

  const comparable = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, s.terminal_type,
                  CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS stage_days,
                  CASE WHEN d.actual_close_date IS NOT NULL THEN CAST(julianday(d.actual_close_date) - julianday(d.created_at) AS INTEGER) ELSE NULL END AS days_to_close
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND d.stage_id = ?
             AND (d.expected_value_minor BETWEEN ? AND ? OR d.expected_value_minor IS NULL)
           LIMIT 50`
        )
        .all(stageId, valueRangeLow, valueRangeHigh) as Array<{
          id: string;
          terminal_type: string | null;
          stage_days: number | null;
          days_to_close: number | null;
        }>
  );

  const won = comparable.filter(c => c.terminal_type === "won").length;
  const lost = comparable.filter(c => c.terminal_type === "lost").length;
  const total = comparable.length;
  const stageDurations = comparable.filter(c => c.stage_days !== null).map(c => c.stage_days as number);
  const typicalDuration = stageDurations.length > 0 ? Math.round(stageDurations.reduce((a, b) => a + b, 0) / stageDurations.length) : null;
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : null;
  const lossRate = total > 0 ? Math.round((lost / total) * 100) : null;
  const confidence = total >= 10 ? "high" : total >= 5 ? "medium" : "low";

  return {
    stageId,
    stageLabel: stage?.label || null,
    typicalDuration,
    conversionRate,
    lossRate,
    comparableDeals: total,
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Contradiction Engine                                                 */
/* ------------------------------------------------------------------ */

export function validateContradictions(
  entityType: "deal" | "lead" | "customer",
  analysis: Record<string, unknown>
): ContradictionResult {
  const contradictions: string[] = [];
  const warnings: string[] = [];

  if (entityType === "deal") {
    const status = analysis.status as string | null;
    const health = analysis.health as string | null;
    const isStalled = analysis.isStalled as boolean | null;
    const daysSinceLastActivity = analysis.daysSinceLastActivity as number | null;
    const engagementTrend = analysis.engagementTrend as string | null;
    const probabilityPct = analysis.probabilityPct as number | null | undefined;
    const riskReasons = analysis.riskReasons as string[] | undefined;
    const expectedValueMinor = analysis.expectedValueMinor as number | null | undefined;
    const targetCloseDate = analysis.targetCloseDate as string | null | undefined;

    if (status === "won" || status === "lost") {
      if (health === "stalled" || health === "critical") {
        contradictions.push(`Deal status is ${status}, but health is marked as "${health}" — terminal deals should not be assessed as stalled or critical.`);
      }
      if (isStalled) {
        contradictions.push(`Deal status is ${status}, but isStalled is true — terminal deals cannot be stalled.`);
      }
    }

    if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
      if (engagementTrend === "increasing") {
        contradictions.push(`No activity for ${daysSinceLastActivity} days, but engagement trend is "increasing" — this is contradictory.`);
      }
      if (engagementTrend === "stable" && daysSinceLastActivity > 7) {
        warnings.push(`Engagement is "stable" despite ${daysSinceLastActivity} days without activity — verify activity data.`);
      }
    }

    if (probabilityPct !== null && probabilityPct !== undefined && probabilityPct >= 70 && isStalled) {
      warnings.push(`High CRM probability (${probabilityPct}%) but deal is stalled — supporting evidence should be provided.`);
    }

    if (probabilityPct !== null && probabilityPct !== undefined && probabilityPct >= 70 && daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
      warnings.push(`CRM probability is ${probabilityPct}% but there has been no activity for ${daysSinceLastActivity} days — confidence should be reduced.`);
    }

    if (expectedValueMinor && expectedValueMinor > 0 && !targetCloseDate) {
      warnings.push(`Deal has value ${(expectedValueMinor / 100).toFixed(2)} SAR but no target close date — timeline clarity is limited.`);
    }

    const hasActiveOpportunities = analysis.hasActiveOpportunities as boolean | null | undefined;
    if (status === "won" && riskReasons && riskReasons.length > 0) {
      warnings.push(`Deal is won but has ${riskReasons.length} risk reasons — verify these are historical context only.`);
    }

    if (status === "lost" && hasActiveOpportunities) {
      warnings.push(`Deal is marked lost but appears to have active opportunities — verify deal status.`);
    }

    if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7 && health === "critical") {
      warnings.push(`Recent activity (${daysSinceLastActivity} days ago) but health is "critical" — verify risk assessment.`);
    }
  }

  if (entityType === "lead") {
    const stage = analysis.stage as string | null;
    const health = analysis.health as string | null;
    const daysSinceLastActivity = analysis.daysSinceLastActivity as number | null;
    const engagementTrend = analysis.engagementTrend as string | null;

    if (stage === "junk" || stage === "lost") {
      if (health === "healthy") {
        contradictions.push(`Lead stage is ${stage}, but health is "healthy" — disqualified leads should not be marked healthy.`);
      }
    }

    if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
      if (engagementTrend === "increasing") {
        contradictions.push(`No activity for ${daysSinceLastActivity} days, but engagement trend is "increasing" — contradictory.`);
      }
    }
  }

  if (entityType === "customer") {
    const riskLevel = analysis.riskLevel as string | null;
    const daysSinceLastActivity = analysis.daysSinceLastActivity as number | null;
    const hasActiveOpportunities = analysis.hasActiveOpportunities as boolean | null;

    if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7 && riskLevel === "critical") {
      warnings.push(`Recent activity (${daysSinceLastActivity} days ago) but risk level is "critical" — verify risk assessment.`);
    }

    if (!hasActiveOpportunities && riskLevel === "critical") {
      warnings.push(`No active opportunities but risk level is "critical" — risk may be overstated.`);
    }
  }

  return {
    hasContradiction: contradictions.length > 0,
    contradictions,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Data Quality Intelligence                                            */
/* ------------------------------------------------------------------ */

export function assessRecordDataQuality(
  entityType: "deal" | "lead" | "customer",
  record: Record<string, unknown>
): { score: number; missingFields: string[]; warnings: string[] } {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (entityType === "deal") {
    if (!record.name) missingFields.push("name");
    if (!record.stage_id) missingFields.push("stage");
    if (!record.expected_value_minor && record.expected_value_minor !== 0) missingFields.push("expected_value");
    if (!record.target_close_date) missingFields.push("target_close_date");
    if (record.probability_pct === null || record.probability_pct === undefined) missingFields.push("probability");
    if (!record.owner_id) missingFields.push("owner");

    if (!record.expected_value_minor && record.expected_value_minor !== 0) {
      warnings.push("Deal value missing — financial priority cannot be assessed.");
    }
    if (!record.target_close_date) {
      warnings.push("Target close date missing — timeline clarity is limited.");
    }
    if (record.probability_pct === null || record.probability_pct === undefined) {
      warnings.push("CRM probability missing — prediction confidence is reduced.");
    }
  }

  if (entityType === "lead") {
    if (!record.full_name) missingFields.push("full_name");
    if (!record.stage_id) missingFields.push("stage");
    if (!record.primary_source_id) missingFields.push("source");
    if (record.probability_pct === null || record.probability_pct === undefined) missingFields.push("probability");
    if (!record.owner_id) missingFields.push("owner");
  }

  if (entityType === "customer") {
    if (!record.name) missingFields.push("name");
    if (!record.industry_id) missingFields.push("industry");
    if (!record.owner_id) missingFields.push("owner");
  }

  const totalExpected = entityType === "deal" ? 6 : entityType === "lead" ? 5 : 3;
  const filledCount = totalExpected - missingFields.length;
  const score = totalExpected > 0 ? Math.round((filledCount / totalExpected) * 100) : 0;

  return { score, missingFields, warnings };
}

/* ------------------------------------------------------------------ */
/* Stage-Aware Intelligence                                             */
/* ------------------------------------------------------------------ */

export function getStageAwareInsights(
  stageId: string | null,
  expectedValueMinor: number | null,
  daysInStage: number | null,
  daysSinceLastActivity: number | null
): { insights: string[]; warnings: string[]; confidence: "high" | "medium" | "low" } {
  const stageContext = getStageHistoricalContext(stageId, expectedValueMinor);
  const insights: string[] = [];
  const warnings: string[] = [];

  if (stageContext.comparableDeals === 0) {
    warnings.push("Historical stage duration is unavailable — no comparable deals found.");
    return { insights, warnings, confidence: "low" };
  }

  if (stageContext.typicalDuration !== null && daysInStage !== null) {
    if (daysInStage > stageContext.typicalDuration * 1.5) {
      insights.push(
        `Deal has been in ${stageContext.stageLabel || "current"} stage for ${daysInStage} days, compared with a historical median of ${stageContext.typicalDuration} days.`
      );
    } else if (daysInStage < stageContext.typicalDuration * 0.5 && daysInStage > 3) {
      insights.push(`Deal is progressing faster than typical for ${stageContext.stageLabel || "this"} stage.`);
    }
  }

  if (stageContext.conversionRate !== null) {
    insights.push(`Historical conversion rate for ${stageContext.stageLabel || "this stage"}: ${stageContext.conversionRate}%.`);
  }

  if (stageContext.lossRate !== null && stageContext.lossRate > 30) {
    warnings.push(`${stageContext.lossRate}% of deals in this stage are historically lost.`);
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14 && stageContext.comparableDeals >= 5) {
    warnings.push(`Combined with ${daysSinceLastActivity} days of inactivity, this deal is underperforming compared to historical stage patterns.`);
  }

  const confidence = stageContext.confidence;
  return { insights, warnings, confidence };
}

/* ------------------------------------------------------------------ */
/* Response / Reciprocity Intelligence                                  */
/* ------------------------------------------------------------------ */

export function assessResponseReciprocity(
  entityType: "deal" | "lead" | "customer",
  entityId: string
): { state: string; evidence: string[]; confidence: "high" | "medium" | "low" } {
  const db = getDb();
  const activities = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.occurred_at, a.direction, a.user_id, a.entity_type
           FROM ${TABLES.activities} a
           WHERE a.entity_type = ? AND a.entity_id = ?
           ORDER BY a.occurred_at DESC LIMIT 20`
        )
        .all(entityType, entityId) as Array<{ occurred_at: string; direction: string | null; user_id: string | null; entity_type: string | null }>
  );

  if (activities.length === 0) {
    return {
      state: "UNKNOWN",
      evidence: ["No activity recorded — response behavior cannot be assessed."],
      confidence: "low",
    };
  }

  const now = new Date();
  const inboundCount = activities.filter(a => a.direction === "inbound").length;
  const outboundCount = activities.filter(a => a.direction === "outbound" || !a.direction).length;
  const recentInbound = activities.filter(a => {
    const d = new Date(a.occurred_at);
    return a.direction === "inbound" && (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  }).length;

  const lastInbound = activities.find(a => a.direction === "inbound");
  const daysSinceLastInbound = lastInbound ? daysBetween(lastInbound.occurred_at, now.toISOString().split("T")[0]) : null;

  let state: string;
  let evidence: string[];

  if (daysSinceLastInbound === null || daysSinceLastInbound > 21) {
    state = "NO_RECENT_RESPONSE";
    evidence = [`No inbound response in ${daysSinceLastInbound !== null ? `${daysSinceLastInbound} days` : "recorded history"}.`];
  } else if (recentInbound >= 2) {
    state = "RESPONSIVE";
    evidence = [`${recentInbound} inbound responses in last 7 days.`, `Total inbound: ${inboundCount}, outbound: ${outboundCount}.`];
  } else if (inboundCount > 0 && inboundCount < outboundCount) {
    state = "PARTIALLY_RESPONSIVE";
    evidence = [`${inboundCount} inbound vs ${outboundCount} outbound activities.`, `Customer responds but less frequently than employee outreach.`];
  } else if (inboundCount === 0 && outboundCount > 0) {
    state = "LOW_RESPONSE";
    evidence = [`${outboundCount} outbound activities with no inbound responses.`, "Customer has not initiated contact."];
  } else {
    state = "UNKNOWN";
    evidence = ["Insufficient activity pattern to determine response behavior."];
  }

  const confidence = activities.length >= 5 ? "high" : activities.length >= 2 ? "medium" : "low";

  return { state, evidence, confidence };
}

/* ------------------------------------------------------------------ */
/* Unified Assessment Builder                                           */
/* ------------------------------------------------------------------ */

export interface UnifiedAssessment {
  overview: string;
  whatChanged: string;
  predictions: {
    label: string;
    value: number;
    confidence: "high" | "medium" | "low";
    basis: string[];
    explanation: string;
    positiveFactors?: string[];
    negativeFactors?: string[];
  }[];
  risks: string[];
  opportunities: string[];
  evidence: string[];
  recommendedAction: string;
  confidence: "high" | "medium" | "low";
  evidenceQuality: EvidenceQuality;
  contradictions: string[];
  warnings: string[];
  behavioralPatterns: BehavioralPattern[];
  dataQualityWarnings: string[];
}

export function buildUnifiedAssessment(params: {
  entityType: "deal" | "lead" | "customer";
  entityId: string;
  baseOverview: string;
  baseRisks: string[];
  baseOpportunities: string[];
  baseEvidence: string[];
  baseRecommendedActions: string[];
  basePredictions?: {
    label: string;
    value: number;
    confidence: "high" | "medium" | "low";
    basis: string[];
    explanation: string;
  }[];
}): UnifiedAssessment {
  const temporal = analyzeTemporalBehavior(params.entityType, params.entityId);
  const changes = detectChanges(params.entityType, params.entityId);
  const patterns = detectBehavioralPatterns(params.entityType, params.entityId);
  const contradictions = validateContradictions(params.entityType, {
    status: params.entityType === "deal" ? (params.baseRisks.includes("stalled") ? "open" : undefined) : undefined,
    health: params.baseRisks.length > 2 ? "at-risk" : undefined,
    isStalled: params.baseRisks.some(r => r.includes("stalled")),
    daysSinceLastActivity: temporal.current.activityCount > 0 ? 0 : null,
    engagementTrend: temporal.trend,
    riskLevel: params.baseRisks.length > 2 ? "high" : "low",
    hasActiveOpportunities: params.baseOpportunities.some(o => o.includes("open") || o.includes("opportunity")),
    probabilityPct: params.basePredictions?.[0]?.value ?? null,
    riskReasons: params.baseRisks,
  });

  const evidenceQuality = assessEvidenceQuality(params.baseEvidence);
  const confidence = evidenceQuality.quality === "strong" ? "high"
    : evidenceQuality.quality === "medium" ? "medium"
    : "low";

  const overview = params.baseOverview;
  const whatChanged = changes.hasChange ? changes.summary : "No significant change detected.";
  const risks = [...params.baseRisks, ...contradictions.warnings];
  const opportunities = params.baseOpportunities;
  const evidence = [...params.baseEvidence, ...temporal.evidence];
  const recommendedAction = params.baseRecommendedActions[0] || "Continue monitoring.";

  return {
    overview,
    whatChanged,
    predictions: params.basePredictions || [],
    risks,
    opportunities,
    evidence,
    recommendedAction,
    confidence,
    evidenceQuality: evidenceQuality.quality,
    contradictions: contradictions.contradictions,
    warnings: contradictions.warnings,
    behavioralPatterns: patterns,
    dataQualityWarnings: evidenceQuality.quality === "weak" || evidenceQuality.quality === "missing"
      ? ["Limited data available — conclusions should be verified with additional CRM information."]
      : [],
  };
}

import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { assessEvidenceQuality } from "@/services/ai-intelligence.service";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PredictionResult {
  label: string;
  value: number;
  confidence: "high" | "medium" | "low";
  basis: string[];
  explanation: string;
  positiveFactors?: string[];
  negativeFactors?: string[];
  historicalBaseline?: number;
}

export interface DealPredictions {
  winProbability: PredictionResult;
  stagnationRisk: PredictionResult;
  followUpPriority: PredictionResult;
  engagementScore: PredictionResult;
}

export interface LeadPredictions {
  conversionProbability: PredictionResult;
  followUpPriority: PredictionResult;
  engagementScore: PredictionResult;
}

export interface CustomerPredictions {
  churnRisk: PredictionResult;
  followUpPriority: PredictionResult;
  engagementScore: PredictionResult;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function daysBetween(a: string | null | unknown, b: string | null | unknown): number | null {
  const sa = typeof a === "string" ? a : null;
  const sb = typeof b === "string" ? b : null;
  if (!sa || !sb) return null;
  try {
    const da = new Date(sa);
    const db = new Date(sb);
    return Math.abs(Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

function safeGet<T>(query: () => T, fallback: T): T {
  try { return query(); } catch { return fallback; }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/* ------------------------------------------------------------------ */
/* Historical Stage Conversion Rates                                   */
/* ------------------------------------------------------------------ */

function calculateStageConversionRate(stageLabel: string | null): number | null {
  if (!stageLabel) return null;

  const db = getDb();
  const stageRow = safeGet(
    () =>
      db
        .prepare(`SELECT id FROM ${TABLES.stages} WHERE label = ? AND pipeline = 'deal' LIMIT 1`)
        .get(stageLabel) as { id: string } | undefined,
    undefined
  );
  if (!stageRow) return null;

  const wonFromStage = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND s.terminal_type = 'won' AND d.stage_id = ?`
        )
        .get(stageRow.id) as { c: number },
    { c: 0 }
  ).c;

  const totalFromStage = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE deleted_at IS NULL AND stage_id = ?`)
        .get(stageRow.id) as { c: number },
    { c: 0 }
  ).c;

  if (totalFromStage === 0) return null;
  return Math.round((wonFromStage / totalFromStage) * 100);
}

/* ------------------------------------------------------------------ */
/* Deal Predictions                                                    */
/* ------------------------------------------------------------------ */

export function predictDeal(dealId: string): DealPredictions | null {
  const db = getDb();
  const deal = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.*, ps.label AS stage_label, ps.is_terminal, ps.terminal_type
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
           WHERE d.id = ? AND d.deleted_at IS NULL
           LIMIT 1`
        )
        .get(dealId) as Record<string, unknown>,
    null
  );

  if (!deal) return null;

  const now = new Date().toISOString().split("T")[0];
  const ageDays = (deal.created_at as string | null) ? daysBetween(deal.created_at as string, now) : null;
  const daysSinceUpdate = (deal.updated_at as string | null) ? daysBetween(deal.updated_at as string, now) : null;
  const targetClose = deal.target_close_date as string | null;
  const expectedValue = (deal.expected_value_minor as number | null) ?? 0;
  const probabilityPct = (deal.probability_pct as number | null) ?? null;
  const stageLabel = deal.stage_label as string | null;

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

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`
        )
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const completedTasks = totalTasks - openTasks;

  const lastActivity = safeGet(
    () =>
      db
        .prepare(
          `SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`
        )
        .get(dealId) as { last: string | null },
    { last: null }
  ).last;

  const daysSinceLastActivity = daysBetween(lastActivity, now);

  const recentActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT occurred_at FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ? ORDER BY occurred_at DESC LIMIT 10`
        )
        .all() as Array<{ occurred_at: string }>,
    []
  );

  let activityTrend: "increasing" | "stable" | "decreasing" | "none" = "none";
  if (recentActivities.length >= 2) {
    const recentCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;
    const olderCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 7 && diff <= 14;
    }).length;
    if (recentCount === 0 && recentActivities.length > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount === 0) {
      activityTrend = "stable";
    } else if (recentCount > olderCount) {
      activityTrend = "increasing";
    } else if (recentCount < olderCount && recentCount > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount > 0) {
      activityTrend = "stable";
    }
  }

  const isStalled =
    (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    (daysSinceUpdate !== null && daysSinceUpdate > 14);
  const isOverdue = targetClose != null && new Date(targetClose) < new Date() && !deal.status;

  const establishmentId = deal.establishment_id as string | null;
  const customerActivities = establishmentId
    ? safeGet(
        () =>
          db
            .prepare(
              `SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'establishment' AND entity_id = ?`
            )
            .get(establishmentId) as { c: number },
        { c: 0 }
      ).c
    : 0;

  /* ------------------------------------------------------------------ */
  /* Win Probability with Historical Baseline                           */
  /* ------------------------------------------------------------------ */

  const winBasis: string[] = [];
  const historicalBaseline = calculateStageConversionRate(stageLabel);
  let winScore = historicalBaseline !== null ? historicalBaseline : 40;

  if (historicalBaseline !== null) {
    winBasis.push(`Historical conversion rate for ${stageLabel || "unknown"}: ${historicalBaseline}%`);
  }

  if (probabilityPct !== null) {
    winScore += probabilityPct * 0.4;
    winBasis.push(`CRM probability: ${probabilityPct}%`);
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    winScore += 15;
    winBasis.push("Recent activity (≤7 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity <= 14) {
    winScore += 8;
    winBasis.push("Moderate activity (≤14 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
    winScore -= 20;
    winBasis.push("No activity for 21+ days");
  }

  if (activityTrend === "increasing") {
    winScore += 10;
    winBasis.push("Increasing engagement trend");
  } else if (activityTrend === "decreasing") {
    winScore -= 10;
    winBasis.push("Decreasing engagement trend");
  }

  if (totalActivities >= 5) {
    winScore += 10;
    winBasis.push(`${totalActivities} total interactions`);
  } else if (totalActivities === 0) {
    winScore -= 10;
    winBasis.push("No recorded interactions");
  }

  if (overdueTasks > 0) {
    winScore -= 5 * overdueTasks;
    winBasis.push(`${overdueTasks} overdue task(s)`);
  }

  if (completedTasks > 0) {
    winScore += 5;
    winBasis.push(`${completedTasks} completed task(s)`);
  }

  if (customerActivities > 3) {
    winScore += 5;
    winBasis.push("Active customer engagement outside deal");
  }

  if (isStalled) {
    winScore -= 15;
    winBasis.push("Deal appears stalled");
  }

  if (isOverdue) {
    winScore -= 10;
    winBasis.push("Past target close date");
  }

  if (stageLabel === "Proposal" || stageLabel === "Negotiation") {
    winScore += 5;
    winBasis.push(`Advanced stage: ${stageLabel}`);
  }

  if (!isStalled && daysSinceUpdate !== null && daysSinceUpdate > 30) {
    winScore -= 10;
    winBasis.push(`Deal has been in current stage for ${daysSinceUpdate} days`);
  } else if (!isStalled && daysSinceUpdate !== null && daysSinceUpdate > 14) {
    winScore -= 5;
    winBasis.push(`${daysSinceUpdate} days in current stage`);
  }

  if (expectedValue > 1000000) {
    winScore += 10;
    winBasis.push(`High-value deal: ${(expectedValue / 100).toFixed(2)} SAR`);
  } else if (expectedValue > 500000) {
    winScore += 5;
    winBasis.push(`Medium-high value deal: ${(expectedValue / 100).toFixed(2)} SAR`);
  }

  let customerWinRate: number | null = null;
  if (establishmentId) {
    const customerStats = safeGet(
      () =>
        db
          .prepare(
            `SELECT 
              COUNT(*) AS total,
              SUM(CASE WHEN s.terminal_type = 'won' THEN 1 ELSE 0 END) AS won
             FROM ${TABLES.deals} d
             LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
             WHERE d.establishment_id = ? AND d.deleted_at IS NULL`
          )
          .get(establishmentId) as { total: number; won: number },
      { total: 0, won: 0 }
    );
    if (customerStats.total > 0) {
      customerWinRate = Math.round((customerStats.won / customerStats.total) * 100);
      if (customerWinRate >= 50) {
        winScore += 8;
        winBasis.push(`Customer has ${customerWinRate}% historical win rate`);
      } else if (customerStats.total >= 3 && customerWinRate < 30) {
        winScore -= 5;
        winBasis.push(`Customer has low historical win rate: ${customerWinRate}%`);
      }
    }
  }

  const winProbability = clamp(Math.round(winScore), 0, 100);
  const winConfidence = determineConfidenceFromEvidence(winBasis, 4);

  const positiveFactors = winBasis.filter((b) => !b.includes("No activity") && !b.includes("decreasing") && !b.includes("stalled") && !b.includes("Past target") && !b.includes("overdue"));
  const negativeFactors = winBasis.filter((b) => b.includes("No activity") || b.includes("decreasing") || b.includes("stalled") || b.includes("Past target") || b.includes("overdue"));

  /* ------------------------------------------------------------------ */
  /* Stagnation Risk                                                     */
  /* ------------------------------------------------------------------ */

  const stagnationBasis: string[] = [];
  let stagnationScore = 0;

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    stagnationScore += 35;
    stagnationBasis.push(`No activity for ${daysSinceLastActivity} days`);
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 7) {
    stagnationScore += 20;
    stagnationBasis.push(`Activity ${daysSinceLastActivity} days ago`);
  }

  if (daysSinceUpdate !== null && daysSinceUpdate > 14) {
    stagnationScore += 25;
    stagnationBasis.push(`No update for ${daysSinceUpdate} days`);
  }

  if (activityTrend === "decreasing" || activityTrend === "none") {
    stagnationScore += 15;
    stagnationBasis.push(`Engagement trend: ${activityTrend}`);
  }

  if (totalActivities > 0 && totalActivities <= 2) {
    stagnationScore += 10;
    stagnationBasis.push("Very few interactions");
  }

  if (overdueTasks > 0) {
    stagnationScore += 10;
    stagnationBasis.push(`${overdueTasks} overdue task(s)`);
  }

  if (ageDays !== null && ageDays > 60 && !isStalled) {
    stagnationScore += 10;
    stagnationBasis.push(`Deal age: ${ageDays} days`);
  }

  const stagnationRisk = clamp(Math.round(stagnationScore), 0, 100);
  const stagnationConfidence = determineConfidenceFromEvidence(stagnationBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Follow-up Priority                                                  */
  /* ------------------------------------------------------------------ */

  const followUpBasis: string[] = [];
  let followUpScore = 0;

  if (isOverdue) {
    followUpScore += 40;
    followUpBasis.push("Past target close date");
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 7) {
    followUpScore += 30;
    followUpBasis.push(`No contact for ${daysSinceLastActivity} days`);
  }

  if (overdueTasks > 0) {
    followUpScore += 20;
    followUpBasis.push(`${overdueTasks} overdue follow-up(s)`);
  }

  if (expectedValue > 500000) {
    followUpScore += 15;
    followUpBasis.push(`High value: ${(expectedValue / 100).toFixed(2)} SAR`);
  }

  if (stageLabel === "Qualified" || stageLabel === "Proposal") {
    followUpScore += 10;
    followUpBasis.push(`In active pipeline stage: ${stageLabel}`);
  }

  if (customerActivities === 0 && totalActivities > 0) {
    followUpScore += 5;
    followUpBasis.push("Customer not directly engaged");
  }

  const followUpPriority = clamp(Math.round(followUpScore), 0, 100);
  const followUpConfidence = determineConfidenceFromEvidence(followUpBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Engagement Score                                                    */
  /* ------------------------------------------------------------------ */

  const engagementBasis: string[] = [];
  let engagementScore = 50;

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 3) {
    engagementScore += 30;
    engagementBasis.push("Recent activity (≤3 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    engagementScore += 20;
    engagementBasis.push("Activity within a week");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
    engagementScore -= 30;
    engagementBasis.push("No activity for 21+ days");
  }

  if (activityTrend === "increasing") {
    engagementScore += 20;
    engagementBasis.push("Increasing interaction frequency");
  } else if (activityTrend === "decreasing") {
    engagementScore -= 15;
    engagementBasis.push("Decreasing interaction frequency");
  }

  if (totalActivities >= 5) {
    engagementScore += 10;
    engagementBasis.push(`${totalActivities} interactions recorded`);
  } else if (totalActivities === 0) {
    engagementScore -= 15;
    engagementBasis.push("No interactions recorded");
  }

  if (openTasks >= 3) {
    engagementScore += 5;
    engagementBasis.push(`${openTasks} open tasks show active work`);
  }

  if (customerActivities > 2) {
    engagementScore += 5;
    engagementBasis.push("Customer has independent CRM activity");
  }

  const engagementScoreFinal = clamp(engagementScore, 0, 100);
  const engagementConfidence = determineConfidenceFromEvidence(engagementBasis, 3);

  return {
    winProbability: {
      label: "Win Probability",
      value: winProbability,
      confidence: winConfidence,
      basis: winBasis,
      explanation: explainWinProbability(winProbability, winBasis, probabilityPct, historicalBaseline),
      positiveFactors,
      negativeFactors,
      historicalBaseline: historicalBaseline ?? undefined,
    },
    stagnationRisk: {
      label: "Stagnation Risk",
      value: stagnationRisk,
      confidence: stagnationConfidence,
      basis: stagnationBasis,
      explanation: explainStagnationRisk(stagnationRisk, stagnationBasis),
    },
    followUpPriority: {
      label: "Follow-up Priority",
      value: followUpPriority,
      confidence: followUpConfidence,
      basis: followUpBasis,
      explanation: explainFollowUpPriority(followUpPriority, followUpBasis),
    },
    engagementScore: {
      label: "Engagement Score",
      value: engagementScoreFinal,
      confidence: engagementConfidence,
      basis: engagementBasis,
      explanation: explainEngagementScore(engagementScoreFinal, engagementBasis),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Lead Predictions                                                    */
/* ------------------------------------------------------------------ */

export function predictLead(leadId: string): LeadPredictions | null {
  const db = getDb();
  const lead = safeGet(
    () =>
      db
        .prepare(
          `SELECT l.*, ps.label AS stage_label FROM ${TABLES.leads} l LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id WHERE l.id = ? AND l.deleted_at IS NULL LIMIT 1`
        )
        .get(leadId) as Record<string, unknown>,
    null
  );

  if (!lead) return null;

  const now = new Date().toISOString().split("T")[0];
  const ageDays = lead.created_at ? daysBetween(lead.created_at, now) : null;
  const probabilityPct = (lead.probability_pct as number | null) ?? null;
  const stageLabel = lead.stage_label as string | null;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`
        )
        .get(leadId) as { c: number },
    { c: 0 }
  ).c;

  const openTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id = ? AND completed_at IS NULL`
        )
        .get(leadId) as { c: number },
    { c: 0 }
  ).c;

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`
        )
        .get(leadId) as { c: number },
    { c: 0 }
  ).c;

  const lastActivity = safeGet(
    () =>
      db
        .prepare(
          `SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`
        )
        .get(leadId) as { last: string | null },
    { last: null }
  ).last;

  const daysSinceLastActivity = daysBetween(lastActivity, now);

  const recentActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT occurred_at FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ? ORDER BY occurred_at DESC LIMIT 10`
        )
        .all() as Array<{ occurred_at: string }>,
    []
  );

  let activityTrend: "increasing" | "stable" | "decreasing" | "none" = "none";
  if (recentActivities.length >= 2) {
    const recentCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;
    const olderCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 7 && diff <= 14;
    }).length;
    if (recentCount === 0 && recentActivities.length > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount === 0) {
      activityTrend = "stable";
    } else if (recentCount > olderCount) {
      activityTrend = "increasing";
    } else if (recentCount < olderCount && recentCount > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount > 0) {
      activityTrend = "stable";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Conversion Probability                                             */
  /* ------------------------------------------------------------------ */

  const conversionBasis: string[] = [];
  let conversionScore = 0;

  if (probabilityPct !== null) {
    conversionScore += probabilityPct * 0.5;
    conversionBasis.push(`CRM probability: ${probabilityPct}%`);
  }

  if (stageLabel === "Qualified" || stageLabel === "Proposal" || stageLabel === "Negotiation") {
    conversionScore += 15;
    conversionBasis.push(`Advanced stage: ${stageLabel}`);
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    conversionScore += 10;
    conversionBasis.push("Recent engagement");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    conversionScore -= 15;
    conversionBasis.push("No recent engagement");
  }

  if (totalActivities >= 3) {
    conversionScore += 10;
    conversionBasis.push(`${totalActivities} interactions`);
  }

  if (activityTrend === "increasing") {
    conversionScore += 10;
    conversionBasis.push("Increasing engagement");
  }

  if (overdueTasks > 0) {
    conversionScore -= 5;
    conversionBasis.push(`${overdueTasks} overdue task(s)`);
  }

  const conversionProbability = clamp(Math.round(conversionScore), 0, 100);
  const conversionConfidence = determineConfidenceFromEvidence(conversionBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Follow-up Priority                                                 */
  /* ------------------------------------------------------------------ */

  const leadFollowUpBasis: string[] = [];
  let leadFollowUpScore = 0;

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 7) {
    leadFollowUpScore += 30;
    leadFollowUpBasis.push(`No activity for ${daysSinceLastActivity} days`);
  }

  if (overdueTasks > 0) {
    leadFollowUpScore += 25;
    leadFollowUpBasis.push(`${overdueTasks} overdue task(s)`);
  }

  if (stageLabel === "Qualified") {
    leadFollowUpScore += 15;
    leadFollowUpBasis.push("Qualified lead ready for next step");
  }

  if (probabilityPct !== null && probabilityPct >= 70) {
    leadFollowUpScore += 15;
    leadFollowUpBasis.push(`High conversion probability: ${probabilityPct}%`);
  }

  if (ageDays !== null && ageDays > 30 && probabilityPct !== null && probabilityPct < 50) {
    leadFollowUpScore += 10;
    leadFollowUpBasis.push(`Aging lead (${ageDays} days) with moderate probability`);
  }

  const leadFollowUpPriority = clamp(Math.round(leadFollowUpScore), 0, 100);
  const leadFollowUpConfidence = determineConfidenceFromEvidence(leadFollowUpBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Engagement Score                                                   */
  /* ------------------------------------------------------------------ */

  const leadEngagementBasis: string[] = [];
  let leadEngagementScore = 50;

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 3) {
    leadEngagementScore += 25;
    leadEngagementBasis.push("Recent activity (≤3 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    leadEngagementScore += 15;
    leadEngagementBasis.push("Activity within a week");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
    leadEngagementScore -= 25;
    leadEngagementBasis.push("No activity for 21+ days");
  }

  if (activityTrend === "increasing") {
    leadEngagementScore += 20;
    leadEngagementBasis.push("Increasing interaction frequency");
  } else if (activityTrend === "decreasing") {
    leadEngagementScore -= 15;
    leadEngagementBasis.push("Decreasing interaction frequency");
  }

  if (totalActivities >= 5) {
    leadEngagementScore += 10;
    leadEngagementBasis.push(`${totalActivities} interactions recorded`);
  } else if (totalActivities === 0) {
    leadEngagementScore -= 10;
    leadEngagementBasis.push("No interactions recorded");
  }

  if (openTasks >= 2) {
    leadEngagementScore += 5;
    leadEngagementBasis.push(`${openTasks} open tasks show active work`);
  }

  const leadEngagementFinal = clamp(leadEngagementScore, 0, 100);
  const leadEngagementConfidence = determineConfidenceFromEvidence(leadEngagementBasis, 3);

  return {
    conversionProbability: {
      label: "Conversion Probability",
      value: conversionProbability,
      confidence: conversionConfidence,
      basis: conversionBasis,
      explanation: explainConversionProbability(conversionProbability, conversionBasis, probabilityPct),
    },
    followUpPriority: {
      label: "Follow-up Priority",
      value: leadFollowUpPriority,
      confidence: leadFollowUpConfidence,
      basis: leadFollowUpBasis,
      explanation: explainFollowUpPriority(leadFollowUpPriority, leadFollowUpBasis),
    },
    engagementScore: {
      label: "Engagement Score",
      value: leadEngagementFinal,
      confidence: leadEngagementConfidence,
      basis: leadEngagementBasis,
      explanation: explainEngagementScore(leadEngagementFinal, leadEngagementBasis),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Customer Predictions                                                */
/* ------------------------------------------------------------------ */

export function predictCustomer(customerId: string): CustomerPredictions | null {
  const db = getDb();
  const customer = safeGet(
    () =>
      db
        .prepare(
          `SELECT e.*, i.label AS industry_label FROM ${TABLES.customers} e LEFT JOIN ${TABLES.industries} i ON i.id = e.industry_id WHERE e.id = ? AND e.deleted_at IS NULL LIMIT 1`
        )
        .get(customerId) as Record<string, unknown>,
    null
  );

  if (!customer) return null;

  const now = new Date().toISOString().split("T")[0];

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE ((a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))`
        )
        .get(customerId, customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const openDeals = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at >= date('now', '-30 days'))`
        )
        .get(customerId) as { c: number },
    { c: 0 }
  ).c;

  const staleDeals = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at < date('now', '-14 days'))`
        )
        .get(customerId) as { c: number },
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

  const lastActivity = safeGet(
    () =>
      db
        .prepare(
          `SELECT MAX(a.occurred_at) AS last FROM ${TABLES.activities} a
           WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))`
        )
        .get(customerId, customerId, customerId) as { last: string | null },
    { last: null }
  ).last;

  const daysSinceLastActivity = daysBetween(lastActivity, now);

  const recentActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT a.occurred_at FROM ${TABLES.activities} a
           WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
           ORDER BY a.occurred_at DESC LIMIT 10`
        )
        .all() as Array<{ occurred_at: string }>,
    []
  );

  let activityTrend: "increasing" | "stable" | "decreasing" | "none" = "none";
  if (recentActivities.length >= 2) {
    const recentCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;
    const olderCount = recentActivities.filter((a) => {
      const d = new Date(a.occurred_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 7 && diff <= 14;
    }).length;
    if (recentCount === 0 && recentActivities.length > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount === 0) {
      activityTrend = "stable";
    } else if (recentCount > olderCount) {
      activityTrend = "increasing";
    } else if (recentCount < olderCount && recentCount > 0) {
      activityTrend = "decreasing";
    } else if (recentCount > 0 && olderCount > 0) {
      activityTrend = "stable";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Churn Risk                                                          */
  /* ------------------------------------------------------------------ */

  const churnBasis: string[] = [];
  let churnScore = 0;

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 30) {
    churnScore += 35;
    churnBasis.push(`No activity for ${daysSinceLastActivity} days`);
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    churnScore += 20;
    churnBasis.push(`Activity ${daysSinceLastActivity} days ago`);
  }

  if (staleDeals > 0) {
    churnScore += 20;
    churnBasis.push(`${staleDeals} stale deal(s)`);
  }

  if (openDeals === 0 && totalActivities > 0) {
    churnScore += 15;
    churnBasis.push("No active open deals");
  }

  if (overdueTasks > 0) {
    churnScore += 10;
    churnBasis.push(`${overdueTasks} overdue task(s)`);
  }

  if (activityTrend === "decreasing") {
    churnScore += 10;
    churnBasis.push("Decreasing engagement trend");
  }

  if (totalActivities === 0) {
    churnScore += 5;
    churnBasis.push("No recorded interactions");
  }

  const churnRisk = clamp(Math.round(churnScore), 0, 100);
  const churnConfidence = determineConfidenceFromEvidence(churnBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Follow-up Priority                                                  */
  /* ------------------------------------------------------------------ */

  const custFollowUpBasis: string[] = [];
  let custFollowUpScore = 0;

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    custFollowUpScore += 35;
    custFollowUpBasis.push(`No activity for ${daysSinceLastActivity} days`);
  }

  if (overdueTasks > 0) {
    custFollowUpScore += 25;
    custFollowUpBasis.push(`${overdueTasks} overdue task(s)`);
  }

  if (staleDeals > 0) {
    custFollowUpScore += 20;
    custFollowUpBasis.push(`${staleDeals} stale deal(s)`);
  }

  if (openDeals > 0) {
    custFollowUpScore += 10;
    custFollowUpBasis.push(`${openDeals} open deal(s)`);
  }

  const custFollowUpPriority = clamp(Math.round(custFollowUpScore), 0, 100);
  const custFollowUpConfidence = determineConfidenceFromEvidence(custFollowUpBasis, 3);

  /* ------------------------------------------------------------------ */
  /* Engagement Score                                                   */
  /* ------------------------------------------------------------------ */

  const custEngagementBasis: string[] = [];
  let custEngagementScore = 50;

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 3) {
    custEngagementScore += 25;
    custEngagementBasis.push("Recent activity (≤3 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    custEngagementScore += 15;
    custEngagementBasis.push("Activity within a week");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 30) {
    custEngagementScore -= 30;
    custEngagementBasis.push("No activity for 30+ days");
  }

  if (activityTrend === "increasing") {
    custEngagementScore += 20;
    custEngagementBasis.push("Increasing interaction frequency");
  } else if (activityTrend === "decreasing") {
    custEngagementScore -= 15;
    custEngagementBasis.push("Decreasing interaction frequency");
  }

  if (totalActivities >= 5) {
    custEngagementScore += 10;
    custEngagementBasis.push(`${totalActivities} interactions recorded`);
  } else if (totalActivities === 0) {
    custEngagementScore -= 10;
    custEngagementBasis.push("No interactions recorded");
  }

  if (openDeals >= 2) {
    custEngagementScore += 5;
    custEngagementBasis.push(`${openDeals} open deals show active relationship`);
  }

  const custEngagementFinal = clamp(custEngagementScore, 0, 100);
  const custEngagementConfidence = determineConfidenceFromEvidence(custEngagementBasis, 3);

  return {
    churnRisk: {
      label: "Churn Risk",
      value: churnRisk,
      confidence: churnConfidence,
      basis: churnBasis,
      explanation: explainChurnRisk(churnRisk, churnBasis),
    },
    followUpPriority: {
      label: "Follow-up Priority",
      value: custFollowUpPriority,
      confidence: custFollowUpConfidence,
      basis: custFollowUpBasis,
      explanation: explainFollowUpPriority(custFollowUpPriority, custFollowUpBasis),
    },
    engagementScore: {
      label: "Engagement Score",
      value: custEngagementFinal,
      confidence: custEngagementConfidence,
      basis: custEngagementBasis,
      explanation: explainEngagementScore(custEngagementFinal, custEngagementBasis),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Confidence Calculator                                               */
/* ------------------------------------------------------------------ */

function determineConfidenceFromEvidence(basis: string[], minRequired: number): "high" | "medium" | "low" {
  if (basis.length === 0) return "low";
  const assessment = assessEvidenceQuality(basis);
  if (assessment.quality === "strong" && basis.length >= minRequired) return "high";
  if (assessment.quality === "medium" && basis.length >= minRequired) return "medium";
  if (basis.length >= minRequired) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Explanations                                                        */
/* ------------------------------------------------------------------ */

function explainWinProbability(score: number, basis: string[], crmProbability: number | null, historicalBaseline: number | null): string {
  const level = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";
  let explanation = `Win probability is assessed as ${level} (${score}%). `;
  if (historicalBaseline !== null) {
    explanation += `Historical baseline for this stage: ${historicalBaseline}%. `;
  }
  if (crmProbability !== null) {
    explanation += `The CRM-stored probability is ${crmProbability}%, which contributes to this assessment. `;
  }
  explanation += `Key factors: ${basis.slice(0, 4).join(", ")}.`;
  return explanation;
}

function explainStagnationRisk(score: number, basis: string[]): string {
  const level = score >= 60 ? "high" : score >= 30 ? "moderate" : "low";
  return `Stagnation risk is ${level} (${score}%). ${basis.length > 0 ? `Contributing factors: ${basis.slice(0, 4).join(", ")}.` : "No significant stagnation signals detected."}`;
}

function explainFollowUpPriority(score: number, basis: string[]): string {
  const level = score >= 60 ? "high" : score >= 30 ? "moderate" : "low";
  return `Follow-up priority is ${level} (${score}%). ${basis.length > 0 ? `Drivers: ${basis.slice(0, 4).join(", ")}.` : "No urgent follow-up signals."}`;
}

function explainEngagementScore(score: number, basis: string[]): string {
  const level = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
  return `Engagement is ${level} (${score}%). ${basis.length > 0 ? `Based on: ${basis.slice(0, 4).join(", ")}.` : "Limited engagement data available."}`;
}

function explainConversionProbability(score: number, basis: string[], crmProbability: number | null): string {
  const level = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";
  let explanation = `Conversion probability is ${level} (${score}%). `;
  if (crmProbability !== null) {
    explanation += `CRM probability: ${crmProbability}%. `;
  }
  explanation += `Basis: ${basis.slice(0, 4).join(", ")}.`;
  return explanation;
}

function explainChurnRisk(score: number, basis: string[]): string {
  const level = score >= 60 ? "high" : score >= 30 ? "moderate" : "low";
  return `Churn risk is ${level} (${score}%). ${basis.length > 0 ? `Contributing factors: ${basis.slice(0, 4).join(", ")}.` : "No significant churn signals detected."}`;
}

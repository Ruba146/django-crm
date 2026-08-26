import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { detectBehavioralPatterns, validateContradictions, assessEvidenceQuality } from "@/services/ai-intelligence.service";
import type { ActionType } from "@/types/ai-chat";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RecommendedAction {
  action: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  urgency: "immediate" | "within_48h" | "within_week" | "routine";
  relatedRecord: {
    type: "deal" | "lead" | "customer" | "task";
    id: string;
    name: string;
  } | null;
  evidence: string[];
  expectedImpact: string[];
  confidence: "high" | "medium" | "low";
  executableType?: ActionType;
  negativeConsequence?: string;
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

function toPriorityLevel(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function confidenceFromEvidence(evidence: string[], minRequired = 3): "high" | "medium" | "low" {
  if (evidence.length === 0) return "low";
  const assessment = assessEvidenceQuality(evidence);
  if (assessment.quality === "strong" && evidence.length >= minRequired + 2) return "high";
  if (assessment.quality === "strong" && evidence.length >= minRequired) return "high";
  if (assessment.quality === "medium" && evidence.length >= minRequired) return "medium";
  if (evidence.length >= minRequired) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Deal Action Recommendation                                          */
/* ------------------------------------------------------------------ */

export function generateDealActionRecommendation(dealId: string): RecommendedAction | null {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

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
        .get(dealId) as Record<string, unknown> | undefined,
    undefined
  );
  if (!deal) return null;

  const evidence: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const daysSinceLastActivity = deal.updated_at ? daysBetween(deal.updated_at as string, now) : null;
  const daysSinceActivity = safeGet(
    () => {
      const last = db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(dealId) as { last: string | null };
      return daysBetween(last.last, now);
    },
    null
  );
  const effectiveDaysSinceActivity = daysSinceActivity ?? daysSinceLastActivity;

  const overdueTasks = safeGet(
    () =>
      db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`).get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const expectedValue = (deal.expected_value_minor as number | null) ?? null;
  const probabilityPct = (deal.probability_pct as number | null) ?? null;
  const stage = deal.stage_label as string | null;
  const isOverdue = deal.target_close_date && new Date(deal.target_close_date as string) < new Date() && !deal.status;
  const isStalled = (effectiveDaysSinceActivity !== null && effectiveDaysSinceActivity > 14) ||
    (daysSinceLastActivity !== null && daysSinceLastActivity > 14);

  if (isOverdue) {
    score += 35;
    reasons.push("Target close date passed");
    evidence.push(`Past target close date (${deal.target_close_date})`);
  }

  if (overdueTasks > 0) {
    score += 25;
    reasons.push(`${overdueTasks} overdue task(s)`);
    evidence.push(`${overdueTasks} follow-up task(s) are overdue`);
  }

  if (expectedValue && expectedValue > 500000) {
    score += 20;
    reasons.push("High-value deal");
    evidence.push(`Expected value: ${(expectedValue / 100).toFixed(2)} SAR`);
  } else if (expectedValue && expectedValue > 100000) {
    score += 12;
    reasons.push("Medium-high value deal");
    evidence.push(`Expected value: ${(expectedValue / 100).toFixed(2)} SAR`);
  }

  if (isStalled) {
    score += 25;
    reasons.push("Deal appears stalled");
    if (effectiveDaysSinceActivity && effectiveDaysSinceActivity > 30) {
      evidence.push(`No activity for ${effectiveDaysSinceActivity} days`);
    } else if (effectiveDaysSinceActivity && effectiveDaysSinceActivity > 14) {
      evidence.push(`No activity for ${effectiveDaysSinceActivity} days`);
    } else {
      evidence.push("No recent updates or activity");
    }
  }

  if (probabilityPct !== null && probabilityPct < 20) {
    score += 15;
    reasons.push("Low CRM probability");
    evidence.push(`CRM probability: ${probabilityPct}%`);
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity > 30) {
    score += 15;
    reasons.push("Prolonged stage duration");
    evidence.push(`Deal has been in ${stage || "current"} stage for ${daysSinceLastActivity} days`);
  }

  if (stage === "Qualified" || stage === "Proposal" || stage === "Negotiation") {
    score += 10;
    reasons.push(`Active pipeline stage: ${stage}`);
    evidence.push(`Currently in ${stage} stage`);
  }

  if (effectiveDaysSinceActivity && effectiveDaysSinceActivity > 7) {
    score += 10;
    reasons.push("No recent activity");
    evidence.push(`Last activity ${effectiveDaysSinceActivity} days ago`);
  }

  if (probabilityPct !== null && probabilityPct >= 70) {
    score -= 5;
    reasons.push("High CRM probability reduces urgency");
    evidence.push(`CRM probability: ${probabilityPct}%`);
  }

  const totalActivities = safeGet(
    () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(dealId) as { c: number },
    { c: 0 }
  ).c;

  if (totalActivities >= 5 && !isStalled) {
    score -= 5;
    reasons.push("Active engagement reduces urgency");
    evidence.push(`${totalActivities} interactions recorded`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priority = toPriorityLevel(priorityScore);

  let action = "Continue monitoring deal progression";
  let expectedImpact: string[] = ["Maintain current trajectory"];
  let executableType: ActionType | undefined;
  let urgency: RecommendedAction["urgency"] = "routine";
  let negativeConsequence: string | undefined;

  if (isOverdue && overdueTasks > 0) {
    action = "Review deal status immediately — past close date with overdue tasks";
    expectedImpact = ["Resolve overdue commitments", "Update deal status", "Prevent further decay"];
    executableType = "update_deal_stage";
    urgency = "immediate";
    negativeConsequence = "Without intervention, the deal will remain in limbo, degrading forecast reliability and potentially damaging customer trust.";
  } else if (isOverdue) {
    action = "Update deal status — past target close date";
    expectedImpact = ["Clear pipeline status", "Trigger next steps"];
    executableType = "update_deal_stage";
    urgency = "immediate";
    negativeConsequence = "Leaving an overdue deal unaddressed skews pipeline reporting and may cause the customer to lose confidence.";
  } else if (isStalled && overdueTasks > 0) {
    action = "Re-engage customer immediately and complete overdue follow-up tasks";
    expectedImpact = ["Recover deal momentum", "Restore engagement rhythm", "Reduce stall risk"];
    executableType = "schedule_followup";
    urgency = "immediate";
    negativeConsequence = "Continued stall with overdue commitments signals disengagement to the customer and increases loss probability.";
  } else if (isStalled) {
    action = "Re-engage customer with a call or meeting to recover momentum";
    expectedImpact = ["Re-establish contact", "Gather updated requirements", "Reduce stall risk"];
    executableType = "schedule_followup";
    urgency = "within_48h";
    negativeConsequence = "Prolonged inactivity accelerates deal decay and reduces the likelihood of a successful close.";
  } else if (overdueTasks > 0) {
    action = `Complete ${overdueTasks} overdue follow-up task(s) to maintain momentum`;
    expectedImpact = ["Restore engagement rhythm", "Prevent deal stagnation"];
    executableType = "create_task";
    urgency = "immediate";
    negativeConsequence = "Unresolved overdue tasks erode customer confidence and may allow competitors to gain ground.";
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 30 && (stage === "Qualified" || stage === "Proposal")) {
    action = "Advance deal stage — prolonged stage duration indicates blocker";
    expectedImpact = ["Move to next stage", "Reduce stagnation risk", "Accelerate close"];
    executableType = "update_deal_stage";
    urgency = "within_week";
    negativeConsequence = "Extended stage duration without progression often indicates unresolved objections or waning interest.";
  } else if (effectiveDaysSinceActivity && effectiveDaysSinceActivity > 14) {
    action = "Schedule follow-up call to maintain engagement";
    expectedImpact = ["Re-engage customer", "Assess current interest", "Prevent further decay"];
    executableType = "schedule_followup";
    urgency = "within_48h";
    negativeConsequence = "Without renewed engagement, the deal risks becoming cold and may be lost to a competitor.";
  }

  if (effectiveDaysSinceActivity && effectiveDaysSinceActivity <= 7 && !isStalled) {
    urgency = "routine";
  }

  const contradictions = validateContradictions("deal", {
    status: deal.status as string | null,
    health: isStalled ? "stalled" : "healthy",
    isStalled,
    daysSinceLastActivity: effectiveDaysSinceActivity,
    engagementTrend: effectiveDaysSinceActivity && effectiveDaysSinceActivity > 14 ? "decreasing" : "stable",
    probabilityPct,
    riskReasons: reasons,
    hasActiveOpportunities: true,
  });

  if (contradictions.warnings.length > 0) {
    evidence.push(...contradictions.warnings.slice(0, 2));
  }

  const behavioralPatterns = detectBehavioralPatterns("deal", dealId);
  for (const pattern of behavioralPatterns.slice(0, 2)) {
    if (pattern.evidence.length > 0) {
      evidence.push(pattern.evidence[0]);
    }
  }

  const dealName = safeGet(
    () => db.prepare(`SELECT name FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(dealId) as { name: string | null } | undefined,
    undefined
  );

  return {
    action,
    reason: reasons.length > 0 ? reasons.join("; ") : "Deal requires attention based on current signals",
    priority,
    urgency,
    relatedRecord: {
      type: "deal",
      id: dealId,
      name: (deal.name as string) || dealName?.name || "Unknown Deal",
    },
    evidence: [...new Set(evidence)].slice(0, 6),
    expectedImpact,
    confidence: confidenceFromEvidence([...new Set(evidence)].slice(0, 6), 3),
    executableType,
    negativeConsequence,
  };
}

/* ------------------------------------------------------------------ */
/* Lead Action Recommendation                                          */
/* ------------------------------------------------------------------ */

export function generateLeadActionRecommendation(leadId: string): RecommendedAction | null {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const lead = safeGet(
    () =>
      db
        .prepare(
          `SELECT l.*, ps.label AS stage_label
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
           WHERE l.id = ? AND l.deleted_at IS NULL
           LIMIT 1`
        )
        .get(leadId) as Record<string, unknown> | undefined,
    undefined
  );
  if (!lead) return null;

  const evidence: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const daysSinceLastActivity = safeGet(
    () => {
      const last = db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`).get(leadId) as { last: string | null };
      return daysBetween(last.last, now);
    },
    null
  );

  const ageDays = lead.created_at ? daysBetween(lead.created_at as string, now) : null;
  const overdueTasks = safeGet(
    () =>
      db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`).get(leadId) as { c: number },
    { c: 0 }
  ).c;

  const probabilityPct = (lead.probability_pct as number | null) ?? null;
  const stage = lead.stage_label as string | null;
  const openDeals = safeGet(
    () => db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE lead_id = ? AND deleted_at IS NULL AND (status IS NULL OR status = '')`).get(leadId) as { c: number },
    { c: 0 }
  ).c;

  if (daysSinceLastActivity && daysSinceLastActivity > 30) {
    score += 30;
    reasons.push(`Lead inactive for ${daysSinceLastActivity} days`);
    evidence.push(`No activity for ${daysSinceLastActivity} days`);
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    score += 20;
    reasons.push(`No activity for ${daysSinceLastActivity} days`);
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  }

  if (overdueTasks > 0) {
    score += 20;
    reasons.push(`${overdueTasks} overdue follow-up task(s)`);
    evidence.push(`${overdueTasks} overdue task(s)`);
  }

  if (probabilityPct !== null && probabilityPct >= 70) {
    score += 15;
    reasons.push("High conversion probability");
    evidence.push(`CRM probability: ${probabilityPct}%`);
  } else if (probabilityPct !== null && probabilityPct >= 40) {
    score += 8;
    reasons.push("Moderate conversion probability");
    evidence.push(`CRM probability: ${probabilityPct}%`);
  }

  if (stage === "Qualified" || stage === "Proposal") {
    score += 10;
    reasons.push(`Advanced stage: ${stage}`);
    evidence.push(`Currently in ${stage} stage`);
  }

  if (ageDays && ageDays > 30 && (!stage || stage === "New")) {
    score += 15;
    reasons.push(`Lead aging without progression (${ageDays} days)`);
    evidence.push(`Lead age: ${ageDays} days in ${stage || "unknown"} stage`);
  }

  if (openDeals > 0) {
    score += 10;
    reasons.push(`${openDeals} open deal(s)`);
    evidence.push(`${openDeals} deal(s) in progress`);
  }

  if (stage === "junk" || stage === "lost") {
    score -= 20;
    reasons.push("Lead is disqualified");
    evidence.push(`Stage: ${stage}`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priority = toPriorityLevel(priorityScore);

  let action = "Continue nurturing this lead";
  let expectedImpact: string[] = ["Maintain engagement"];
  let executableType: ActionType | undefined;
  let urgency: RecommendedAction["urgency"] = "routine";
  let negativeConsequence: string | undefined;

  if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    action = "Schedule follow-up call immediately to re-engage cold lead";
    expectedImpact = ["Re-establish contact", "Assess current interest", "Prevent lead decay"];
    executableType = "schedule_followup";
    urgency = "within_48h";
    negativeConsequence = "A cold lead is unlikely to convert without renewed engagement, wasting the investment made in acquisition.";
  } else if (overdueTasks > 0) {
    action = "Complete overdue follow-up tasks to restore engagement rhythm";
    expectedImpact = ["Restore follow-up cadence", "Re-engage lead"];
    executableType = "create_task";
    urgency = "immediate";
    negativeConsequence = "Unaddressed overdue follow-ups signal neglect to the lead and reduce conversion probability.";
  } else if (stage === "Qualified" && openDeals === 0) {
    action = "Convert qualified lead into a formal deal";
    expectedImpact = ["Advance sales pipeline", "Increase conversion rate"];
    executableType = "create_deal";
    urgency = "within_week";
    negativeConsequence = "Delaying conversion allows the lead to cool and potentially choose a competitor.";
  } else if (probabilityPct !== null && probabilityPct >= 70) {
    action = "Schedule demo or proposal meeting to close high-probability lead";
    expectedImpact = ["Accelerate conversion", "Move to deal stage"];
    executableType = "schedule_followup";
    urgency = "within_week";
    negativeConsequence = "High-probability leads that are not moved forward quickly often lose momentum and drop off.";
  }

  const contradictions = validateContradictions("lead", {
    stage,
    health: daysSinceLastActivity && daysSinceLastActivity > 30 ? "stale" : daysSinceLastActivity && daysSinceLastActivity > 14 ? "at-risk" : "healthy",
    daysSinceLastActivity,
    engagementTrend: daysSinceLastActivity && daysSinceLastActivity > 14 ? "decreasing" : "stable",
  });

  if (contradictions.warnings.length > 0) {
    evidence.push(...contradictions.warnings.slice(0, 2));
  }

  const behavioralPatterns = detectBehavioralPatterns("lead", leadId);
  for (const pattern of behavioralPatterns.slice(0, 2)) {
    if (pattern.evidence.length > 0) {
      evidence.push(pattern.evidence[0]);
    }
  }

  const uniqueEvidence = [...new Set(evidence)].slice(0, 6);
  const uniqueReasons = [...new Set(reasons)].slice(0, 4);
  const confidence = confidenceFromEvidence(uniqueEvidence, 3);

  return {
    action,
    reason: uniqueReasons.length > 0 ? uniqueReasons.join("; ") : "Lead requires follow-up based on current signals",
    priority,
    urgency,
    relatedRecord: {
      type: "lead",
      id: leadId,
      name: (lead.full_name as string) || "Unknown Lead",
    },
    evidence: uniqueEvidence,
    expectedImpact,
    confidence,
    executableType,
    negativeConsequence,
  };
}

/* ------------------------------------------------------------------ */
/* Customer Action Recommendation                                       */
/* ------------------------------------------------------------------ */

export function generateCustomerActionRecommendation(customerId: string): RecommendedAction | null {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const customer = safeGet(
    () => db.prepare(`SELECT id, name FROM ${TABLES.customers} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(customerId) as { id: string; name: string | null } | undefined,
    undefined
  );
  if (!customer) return null;

  const evidence: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const daysSinceLastActivity = safeGet(
    () => {
      const last = db.prepare(
        `SELECT MAX(a.occurred_at) AS last FROM ${TABLES.activities} a
         WHERE (a.entity_type = 'establishment' AND a.entity_id = ?)
            OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))
            OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))`
      ).get(customerId, customerId, customerId) as { last: string | null };
      return daysBetween(last.last, now);
    },
    null
  );

  const overdueTasks = safeGet(
    () =>
      db.prepare(
        `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
         WHERE ((t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
            OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))
           AND t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now')`
      ).get(customerId, customerId) as { c: number },
    { c: 0 }
  ).c;

  const openDeals = safeGet(
    () =>
      db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at >= date('now', '-30 days'))`).get(customerId) as { c: number },
    { c: 0 }
  ).c;

  const staleDeals = safeGet(
    () =>
      db.prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at < date('now', '-14 days'))`).get(customerId) as { c: number },
    { c: 0 }
  ).c;

  if (daysSinceLastActivity && daysSinceLastActivity > 30) {
    score += 35;
    reasons.push(`Customer inactive for ${daysSinceLastActivity} days`);
    evidence.push(`No activity for ${daysSinceLastActivity} days`);
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    score += 20;
    reasons.push(`No activity for ${daysSinceLastActivity} days`);
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  }

  if (overdueTasks > 0) {
    score += 25;
    reasons.push(`${overdueTasks} overdue follow-up task(s)`);
    evidence.push(`${overdueTasks} overdue task(s) linked to this customer`);
  }

  if (staleDeals > 0) {
    score += 15;
    reasons.push("Contains stale deals");
    evidence.push("Deals with no recent activity detected");
  }

  if (openDeals > 0) {
    score += 10;
    reasons.push(`${openDeals} open deal(s)`);
    evidence.push(`${openDeals} active opportunities`);
  }

  if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
    score -= 10;
    reasons.push("Recent engagement");
    evidence.push(`Last activity ${daysSinceLastActivity} days ago`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priority = toPriorityLevel(priorityScore);

  let action = "Continue current engagement rhythm";
  let expectedImpact: string[] = ["Maintain relationship"];
  let executableType: ActionType | undefined;
  let urgency: RecommendedAction["urgency"] = "routine";
  let negativeConsequence: string | undefined;

  if (daysSinceLastActivity && daysSinceLastActivity > 30 && openDeals > 0) {
    action = "Re-engage immediately — active deals with no contact for 30+ days";
    expectedImpact = ["Recover deal momentum", "Prevent churn", "Restore relationship"];
    executableType = "schedule_followup";
    urgency = "immediate";
    negativeConsequence = "Extended customer silence with active opportunities significantly raises churn risk and may result in lost revenue.";
  } else if (overdueTasks > 0 && openDeals > 0) {
    action = "Complete overdue tasks and schedule follow-up with active deals";
    expectedImpact = ["Restore engagement", "Resolve pending commitments"];
    executableType = "create_task";
    urgency = "immediate";
    negativeConsequence = "Unresolved commitments and lack of follow-up damage trust and can cause active deals to stall or close elsewhere.";
  } else if (overdueTasks > 0) {
    action = "Complete overdue follow-up tasks to restore engagement";
    expectedImpact = ["Restore engagement rhythm"];
    executableType = "create_task";
    urgency = "immediate";
    negativeConsequence = "Accumulating overdue tasks signal poor relationship management and reduce the likelihood of future business.";
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14 && openDeals > 0) {
    action = "Schedule follow-up call to maintain active deal momentum";
    expectedImpact = ["Maintain engagement", "Prevent deal decay"];
    executableType = "schedule_followup";
    urgency = "within_48h";
    negativeConsequence = "Without proactive outreach, active deals may lose momentum and the customer relationship will weaken.";
  } else if (staleDeals > 0) {
    action = "Review and update stale deals to prevent pipeline decay";
    expectedImpact = ["Revitalize pipeline", "Identify salvageable opportunities"];
    urgency = "within_week";
    negativeConsequence = "Stale deals that are not reviewed may need to be closed or marked lost, reducing pipeline visibility.";
  }

  const contradictions = validateContradictions("customer", {
    riskLevel: priority,
    daysSinceLastActivity,
    hasActiveOpportunities: openDeals > 0,
  });

  if (contradictions.warnings.length > 0) {
    evidence.push(...contradictions.warnings.slice(0, 2));
  }

  const behavioralPatterns = detectBehavioralPatterns("customer", customerId);
  for (const pattern of behavioralPatterns.slice(0, 2)) {
    if (pattern.evidence.length > 0) {
      evidence.push(pattern.evidence[0]);
    }
  }

  const uniqueEvidence = [...new Set(evidence)].slice(0, 6);
  const uniqueReasons = [...new Set(reasons)].slice(0, 4);
  const confidence = confidenceFromEvidence(uniqueEvidence, 3);

  return {
    action,
    reason: uniqueReasons.length > 0 ? uniqueReasons.join("; ") : "Customer relationship requires attention based on current signals",
    priority,
    urgency,
    relatedRecord: {
      type: "customer",
      id: customerId,
      name: customer.name || "Unknown Customer",
    },
    evidence: uniqueEvidence,
    expectedImpact,
    confidence,
    executableType,
    negativeConsequence,
  };
}

/* ------------------------------------------------------------------ */
/* Task Action Recommendation                                           */
/* ------------------------------------------------------------------ */

export function generateTaskActionRecommendation(taskId: string): RecommendedAction | null {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const task = safeGet(
    () =>
      db
        .prepare(`SELECT t.*, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.id = ? LIMIT 1`)
        .get(taskId) as Record<string, unknown> | undefined,
    undefined
  );
  if (!task) return null;

  const evidence: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const isOverdue = task.completed_at === null && task.due_at && new Date(task.due_at as string) < new Date();
  const daysOverdue = isOverdue ? daysBetween(now, task.due_at as string) : null;
  const daysUntilDue = !isOverdue && task.due_at ? daysBetween(now, task.due_at as string) : null;

  let relatedRecordValueMinor: number | null = null;
  let relatedRecordStage: string | null = null;
  let relatedRecordDaysSinceActivity: number | null = null;
  let relatedRecordName: string | null = null;
  let relatedRecordType: "deal" | "lead" | "customer" | "task" | null = null;

  const entityType = task.entity_type as string | null;
  const entityId = task.entity_id as string | null;

  if (entityType === "deal" && entityId) {
    relatedRecordType = "deal";
    const deal = safeGet(
      () => db.prepare(`SELECT name, expected_value_minor, stage_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(entityId) as { name: string | null; expected_value_minor: number | null; stage_id: string | null } | undefined,
      undefined
    );
    if (deal) {
      relatedRecordValueMinor = deal.expected_value_minor;
      relatedRecordName = deal.name;
      if (deal.stage_id) {
        const stage = safeGet(() => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(deal.stage_id) as { label: string | null } | undefined, undefined);
        relatedRecordStage = stage?.label ?? null;
      }
    }
    const lastAct = safeGet(
      () => db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`).get(entityId) as { last: string | null },
      { last: null }
    );
    if (lastAct.last) relatedRecordDaysSinceActivity = daysBetween(lastAct.last, now);
  } else if (entityType === "lead" && entityId) {
    relatedRecordType = "lead";
    const lead = safeGet(
      () => db.prepare(`SELECT full_name, stage_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`).get(entityId) as { full_name: string | null; stage_id: string | null } | undefined,
      undefined
    );
    if (lead) {
      relatedRecordName = lead.full_name;
      if (lead.stage_id) {
        const stage = safeGet(() => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(lead.stage_id) as { label: string | null } | undefined, undefined);
        relatedRecordStage = stage?.label ?? null;
      }
    }
    const lastAct = safeGet(
      () => db.prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`).get(entityId) as { last: string | null },
      { last: null }
    );
    if (lastAct.last) relatedRecordDaysSinceActivity = daysBetween(lastAct.last, now);
  } else if (entityType === "establishment" && entityId) {
    relatedRecordType = "customer";
    const est = safeGet(() => db.prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? LIMIT 1`).get(entityId) as { name: string | null } | undefined, undefined);
    relatedRecordName = est?.name ?? null;
  }

  if (isOverdue) {
    score += 35;
    reasons.push("Task is overdue");
    evidence.push(`Overdue by ${Math.abs(daysOverdue || 0)} days`);
  }

  if (relatedRecordValueMinor && relatedRecordValueMinor > 500000) {
    score += 20;
    reasons.push("Linked to high-value deal");
    evidence.push(`Related deal value: ${(relatedRecordValueMinor / 100).toFixed(2)} SAR`);
  } else if (relatedRecordValueMinor && relatedRecordValueMinor > 0) {
    score += 10;
    reasons.push("Linked to deal with value");
    evidence.push(`Related deal value: ${(relatedRecordValueMinor / 100).toFixed(2)} SAR`);
  }

  if (relatedRecordStage === "Qualified" || relatedRecordStage === "Proposal" || relatedRecordStage === "Negotiation") {
    score += 10;
    reasons.push("Related record in active stage");
    evidence.push(`Related record stage: ${relatedRecordStage}`);
  }

  if (daysUntilDue !== null && daysUntilDue < 3) {
    score += 15;
    reasons.push("Due very soon");
    evidence.push(`Due in ${daysUntilDue} days`);
  }

  if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 14) {
    score += 10;
    reasons.push("Related record has no recent activity");
    evidence.push(`Related record inactive for ${relatedRecordDaysSinceActivity} days`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priority = toPriorityLevel(priorityScore);

  let action = "Complete the task";
  let expectedImpact: string[] = ["Clear pending work"];
  let executableType: ActionType | undefined;
  let urgency: RecommendedAction["urgency"] = "routine";
  let negativeConsequence: string | undefined;

  if (isOverdue && relatedRecordValueMinor && relatedRecordValueMinor > 100000) {
    action = "Complete immediately — overdue task linked to high-value deal";
    expectedImpact = ["Prevent deal stagnation", "Maintain customer confidence"];
    executableType = "create_activity";
    urgency = "immediate";
    negativeConsequence = "An overdue task on a high-value deal signals declining engagement and increases the risk of losing the opportunity.";
  } else if (isOverdue) {
    action = "Complete immediately — task is overdue";
    expectedImpact = ["Restore task rhythm", "Prevent further delays"];
    executableType = "create_activity";
    urgency = "immediate";
    negativeConsequence = "Overdue tasks that remain incomplete erode organizational discipline and may cascade into larger delays.";
  } else if (daysUntilDue !== null && daysUntilDue < 3) {
    action = "Complete today — due very soon";
    expectedImpact = ["Meet deadline", "Maintain momentum"];
    urgency = "within_48h";
    negativeConsequence = "Missing an imminent deadline damages reliability and may block downstream work.";
  }

  if (relatedRecordDaysSinceActivity && relatedRecordDaysSinceActivity > 14) {
    evidence.push(`Related record has had no activity for ${relatedRecordDaysSinceActivity} days`);
    if (!action.includes("related record")) {
      expectedImpact.push("Re-engage related record");
    }
  }

  const uniqueEvidence = [...new Set(evidence)].slice(0, 6);
  const uniqueReasons = [...new Set(reasons)].slice(0, 4);
  const confidence = confidenceFromEvidence(uniqueEvidence, 3);

  return {
    action,
    reason: uniqueReasons.length > 0 ? uniqueReasons.join("; ") : "Task requires completion based on current signals",
    priority,
    urgency,
    relatedRecord: relatedRecordType && relatedRecordName ? {
      type: relatedRecordType,
      id: entityId || taskId,
      name: relatedRecordName,
    } : null,
    evidence: uniqueEvidence,
    expectedImpact,
    confidence,
    executableType,
    negativeConsequence,
  };
}

/* ------------------------------------------------------------------ */
/* Global Action Recommendations                                        */
/* ------------------------------------------------------------------ */

export interface GlobalActionRecommendations {
  topPriority: RecommendedAction | null;
  byEntity: Array<{
    entityType: "deal" | "customer" | "lead" | "task";
    entityId: string;
    entityName: string;
    action: RecommendedAction;
  }>;
  summary: string;
}

export function generateGlobalActionRecommendations(): GlobalActionRecommendations {
  const db = getDb();
  const allItems: Array<{
    entityType: "deal" | "customer" | "lead" | "task";
    entityId: string;
    entityName: string;
    priorityScore: number;
  }> = [];

  const deals = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, e.name AS company, s.label AS stage, d.expected_value_minor,
                  d.probability_pct, d.target_close_date, d.updated_at, d.created_at, d.establishment_id, d.stage_id, d.owner_id
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND (s.is_terminal IS NULL OR s.is_terminal = 0)
           ORDER BY d.expected_value_minor DESC`
        )
        .all() as Array<{
          id: string;
          name: string | null;
          company: string | null;
          stage: string | null;
          expected_value_minor: number | null;
          probability_pct: number | null;
          target_close_date: string | null;
          updated_at: string | null;
          created_at: string | null;
          establishment_id: string | null;
          stage_id: string | null;
          owner_id: string | null;
        }>
  );
  const uniqueDeals = Array.from(
    new Map(deals.map((d) => [d.id, d])).values()
  );

  for (const deal of uniqueDeals) {
    const action = generateDealActionRecommendation(deal.id);
    if (action) {
      allItems.push({
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.name || deal.company || "Untitled Deal",
        priorityScore: { critical: 90, high: 70, medium: 50, low: 30 }[action.priority] || 0,
      });
    }
  }

  const customers = safeAll(
    () =>
      db
        .prepare(`SELECT id, name FROM ${TABLES.customers} WHERE deleted_at IS NULL ORDER BY name ASC`)
        .all() as { id: string; name: string | null }[]
  );
  const uniqueCustomers = Array.from(
    new Map(customers.map((c) => [c.id, c])).values()
  );

  for (const customer of uniqueCustomers) {
    const action = generateCustomerActionRecommendation(customer.id);
    if (action) {
      allItems.push({
        entityType: "customer",
        entityId: customer.id,
        entityName: customer.name || "Unknown",
        priorityScore: { critical: 90, high: 70, medium: 50, low: 30 }[action.priority] || 0,
      });
    }
  }

  const leads = safeAll(
    () =>
      db
        .prepare(
          `SELECT l.id, l.full_name, s.label AS stage, l.probability_pct, l.created_at
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.stages} s ON s.id = l.stage_id
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
           ORDER BY l.created_at ASC`
        )
        .all() as { id: string; full_name: string | null; stage: string | null; probability_pct: number | null; created_at: string | null }[]
  );
  const uniqueLeads = Array.from(
    new Map(leads.map((l) => [l.id, l])).values()
  );

  for (const lead of uniqueLeads) {
    const action = generateLeadActionRecommendation(lead.id);
    if (action) {
      allItems.push({
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.full_name || "Unknown Lead",
        priorityScore: { critical: 90, high: 70, medium: 50, low: 30 }[action.priority] || 0,
      });
    }
  }

  const tasks = safeAll(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.entity_type, t.entity_id, t.due_at, t.completed_at
           FROM ${TABLES.tasks} t
           WHERE t.completed_at IS NULL
           ORDER BY t.due_at ASC`
        )
        .all() as { id: string; title: string | null; entity_type: string | null; entity_id: string | null; due_at: string | null; completed_at: string | null }[]
  );

  for (const task of tasks) {
    const action = generateTaskActionRecommendation(task.id);
    if (action) {
      allItems.push({
        entityType: "task",
        entityId: task.id,
        entityName: task.title || "Untitled Task",
        priorityScore: { critical: 90, high: 70, medium: 50, low: 30 }[action.priority] || 0,
      });
    }
  }

  allItems.sort((a, b) => b.priorityScore - a.priorityScore);

  const byEntity: GlobalActionRecommendations["byEntity"] = [];
  let topPriority: RecommendedAction | null = null;
  let topScore = -1;

  for (const item of allItems) {
    let action: RecommendedAction | null = null;
    try {
      switch (item.entityType) {
        case "deal":
          action = generateDealActionRecommendation(item.entityId);
          break;
        case "customer":
          action = generateCustomerActionRecommendation(item.entityId);
          break;
        case "lead":
          action = generateLeadActionRecommendation(item.entityId);
          break;
        case "task":
          action = generateTaskActionRecommendation(item.entityId);
          break;
      }
    } catch {
      // skip items that fail analysis
    }

    if (action) {
      byEntity.push({
        entityType: item.entityType,
        entityId: item.entityId,
        entityName: item.entityName,
        action,
      });

      if (item.priorityScore > topScore) {
        topScore = item.priorityScore;
        topPriority = action;
      }
    }
  }

  const summary = byEntity.length > 0
    ? `You have ${byEntity.length} priority item(s) requiring attention today. The most urgent is: ${topPriority?.action || "No immediate actions identified"}.`
    : "No urgent actions identified today. Continue with your current routine.";

  return {
    topPriority,
    byEntity: byEntity.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.action.priority] || 4) - (order[b.action.priority] || 4);
    }),
    summary,
  };
}

/* ------------------------------------------------------------------ */
/* Action Explanation Builder                                          */
/* ------------------------------------------------------------------ */

export function buildActionExplanation(action: RecommendedAction): string {
  const lines: string[] = [];

  lines.push(`**Recommended Action:** ${action.action}`);
  lines.push("");
  lines.push(`**Why:** ${action.reason}`);
  lines.push("");

  if (action.evidence.length > 0) {
    lines.push("**Evidence:**");
    action.evidence.forEach((e) => {
      lines.push(`- ${e}`);
    });
    lines.push("");
  }

  if (action.expectedImpact.length > 0) {
    lines.push("**Expected Impact:**");
    action.expectedImpact.forEach((impact) => {
      lines.push(`- ${impact}`);
    });
    lines.push("");
  }

  if (action.negativeConsequence) {
    lines.push("**If No Action Is Taken:**");
    lines.push(`- ${action.negativeConsequence}`);
    lines.push("");
  }

  lines.push(`**Confidence:** ${action.confidence.toUpperCase()}`);

  return lines.join("\n");
}

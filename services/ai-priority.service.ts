import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PriorityResult {
  priorityScore: number;
  priorityLevel: "critical" | "high" | "medium" | "low";
  reasons: string[];
  evidence: string[];
  recommendedAction: string;
}

export interface DailyBriefing {
  executiveSummary: string;
  todayPriorities: Array<{
    entityType: "deal" | "customer" | "lead" | "task";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    value?: number;
    currency?: string;
  }>;
  atRiskDeals: Array<{
    entityType: "deal";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    riskScore: number;
    riskLevel: "critical" | "high" | "medium" | "low";
    expectedValueMinor: number | null;
    currencyCode: string | null;
  }>;
  customersRequiringAttention: Array<{
    entityType: "customer";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    daysSinceActivity: number | null;
    openDeals: number;
  }>;
  overdueTasks: Array<{
    entityType: "task";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    daysOverdue: number;
    relatedRecordValueMinor: number | null;
  }>;
  suggestedFollowUps: Array<{
    entityType: "customer" | "lead" | "deal";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    daysSinceActivity: number | null;
  }>;
  opportunities: Array<{
    entityType: "deal" | "lead";
    entityId: string;
    entityName: string;
    priority: "critical" | "high" | "medium" | "low";
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    expectedValueMinor: number | null;
  }>;
  employeeSummary: {
    overdueTasks: number;
    todayTasks: number;
    highPriorityDeals: number;
    customersNeedingAttention: number;
    leadsNeedingFollowUp: number;
    recommendedActions: string[];
  };
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

/* ------------------------------------------------------------------ */
/* Deal Priority                                                       */
/* ------------------------------------------------------------------ */

interface DealPriorityInput {
  id: string;
  name: string | null;
  company: string | null;
  stage: string | null;
  expectedValueMinor: number | null;
  probabilityPct: number | null;
  targetCloseDate: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  ownerId: string | null;
  establishmentId: string | null;
  stageId: string | null;
}

function getDealPriority(deal: DealPriorityInput): PriorityResult {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];
  const reasons: string[] = [];
  const evidence: string[] = [];
  let score = 0;

  const daysSinceUpdate = deal.updatedAt ? daysBetween(deal.updatedAt, now) : null;
  const daysUntilClose = deal.targetCloseDate ? daysBetween(now, deal.targetCloseDate) : null;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(deal.id) as { c: number },
    { c: 0 }
  ).c;

  const lastActivity = safeGet(
    () =>
      db
        .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(deal.id) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
        .get(deal.id) as { c: number },
    { c: 0 }
  ).c;

  const isStalled = (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    (daysSinceUpdate !== null && daysSinceUpdate > 14);
  const isOverdue = deal.targetCloseDate && new Date(deal.targetCloseDate) < new Date();

  if (isOverdue) {
    score += 35;
    reasons.push("Target close date passed");
    evidence.push(`Target close date was ${deal.targetCloseDate}`);
  }

  if (overdueTasks > 0) {
    score += 25;
    reasons.push(`${overdueTasks} overdue task(s)`);
    evidence.push(`${overdueTasks} follow-up task(s) are overdue`);
  }

  if (deal.expectedValueMinor && deal.expectedValueMinor > 500000) {
    score += 20;
    reasons.push("High-value deal");
    evidence.push(`Expected value: ${(deal.expectedValueMinor / 100).toFixed(2)} SAR`);
  } else if (deal.expectedValueMinor && deal.expectedValueMinor > 100000) {
    score += 12;
    reasons.push("Medium-high value deal");
    evidence.push(`Expected value: ${(deal.expectedValueMinor / 100).toFixed(2)} SAR`);
  }

  if (isStalled) {
    score += 25;
    reasons.push("Deal appears stalled");
    if (daysSinceLastActivity && daysSinceLastActivity > 30) {
      evidence.push(`No activity for ${daysSinceLastActivity} days`);
    } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
      evidence.push(`No activity for ${daysSinceLastActivity} days`);
    } else {
      evidence.push("No recent updates or activity");
    }
  }

  if (deal.probabilityPct !== null && deal.probabilityPct < 20) {
    score += 15;
    reasons.push("Low CRM probability");
    evidence.push(`CRM probability: ${deal.probabilityPct}%`);
  }

  if (daysUntilClose !== null && daysUntilClose < 7) {
    score += 20;
    reasons.push("Target close date approaching");
    evidence.push(`Target close in ${daysUntilClose} days`);
  } else if (daysUntilClose !== null && daysUntilClose < 14) {
    score += 12;
    reasons.push("Target close date within 2 weeks");
    evidence.push(`Target close in ${daysUntilClose} days`);
  }

  if (deal.stage === "Qualified" || deal.stage === "Proposal" || deal.stage === "Negotiation") {
    score += 10;
    reasons.push(`Active pipeline stage: ${deal.stage}`);
    evidence.push(`Currently in ${deal.stage} stage`);
  }

  if (daysSinceLastActivity && daysSinceLastActivity > 7) {
    score += 10;
    reasons.push("No recent activity");
    evidence.push(`Last activity ${daysSinceLastActivity} days ago`);
  }

  if (deal.establishmentId) {
    const customerActivities = safeGet(
      () =>
        db
          .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'establishment' AND entity_id = ?`)
          .get(deal.establishmentId) as { c: number },
      { c: 0 }
    ).c;
    if (customerActivities === 0 && totalActivities > 0) {
      score += 5;
      reasons.push("Customer not directly engaged");
      evidence.push("All activity is deal-specific, no direct customer engagement");
    }
  }

  if (deal.probabilityPct !== null && deal.probabilityPct >= 70) {
    score -= 5;
    reasons.push("High CRM probability reduces urgency");
    evidence.push(`CRM probability: ${deal.probabilityPct}%`);
  }

  if (totalActivities >= 5 && !isStalled) {
    score -= 5;
    reasons.push("Active engagement reduces urgency");
    evidence.push(`${totalActivities} interactions recorded`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priorityLevel = toPriorityLevel(priorityScore);

  let recommendedAction = "Continue monitoring deal progression";
  if (isOverdue && overdueTasks > 0) {
    recommendedAction = "Review deal status immediately — past close date with overdue tasks";
  } else if (isOverdue) {
    recommendedAction = "Update deal status — past target close date";
  } else if (isStalled && overdueTasks > 0) {
    recommendedAction = "Re-engage customer immediately and complete overdue follow-up tasks";
  } else if (isStalled) {
    recommendedAction = "Re-engage customer with a call or meeting to recover momentum";
  } else if (overdueTasks > 0) {
    recommendedAction = `Complete ${overdueTasks} overdue follow-up task(s) to maintain momentum`;
  } else if (daysUntilClose !== null && daysUntilClose < 14) {
    recommendedAction = "Prepare for close — advance deal stage or resolve blockers";
  }

  return {
    priorityScore,
    priorityLevel,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
    recommendedAction,
  };
}

/* ------------------------------------------------------------------ */
/* Customer Priority                                                    */
/* ------------------------------------------------------------------ */

interface CustomerPriorityInput {
  id: string;
  name: string | null;
}

function getCustomerPriority(customer: CustomerPriorityInput): PriorityResult {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];
  const reasons: string[] = [];
  const evidence: string[] = [];
  let score = 0;

  const openDeals = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at >= date('now', '-30 days'))`)
        .get(customer.id) as { c: number },
    { c: 0 }
  ).c;

  const staleDeals = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL AND (updated_at IS NULL OR updated_at < date('now', '-14 days'))`)
        .get(customer.id) as { c: number },
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
        .get(customer.id, customer.id) as { c: number },
    { c: 0 }
  ).c;

  const totalActivities = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
           WHERE ((a.entity_type = 'establishment' AND a.entity_id = ?)
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL))
              OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL)))`
        )
        .get(customer.id, customer.id, customer.id) as { c: number },
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
        .get(customer.id, customer.id, customer.id) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;

  const totalDealValue = safeGet(
    () =>
      db
        .prepare(
          `SELECT COALESCE(SUM(d.expected_value_minor), 0) AS total FROM ${TABLES.deals} d
           WHERE d.establishment_id = ? AND d.deleted_at IS NULL`
        )
        .get(customer.id) as { total: number },
    { total: 0 }
  ).total;

  if (overdueTasks > 0) {
    score += 25;
    reasons.push(`${overdueTasks} overdue follow-up task(s)`);
    evidence.push(`${overdueTasks} overdue task(s) linked to this customer`);
  }

  if (totalDealValue > 500000) {
    score += 20;
    reasons.push("High total deal value");
    evidence.push(`Total deal value: ${(totalDealValue / 100).toFixed(2)} SAR`);
  } else if (totalDealValue > 100000) {
    score += 12;
    reasons.push("Medium-high deal value");
    evidence.push(`Total deal value: ${(totalDealValue / 100).toFixed(2)} SAR`);
  }

  if (daysSinceLastActivity && daysSinceLastActivity > 30) {
    score += 30;
    reasons.push(`Customer inactive for ${daysSinceLastActivity} days`);
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    score += 20;
    reasons.push(`No activity for ${daysSinceLastActivity} days`);
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  }

  if (openDeals > 0 && staleDeals > 0) {
    score += 15;
    reasons.push(`${staleDeals} stale deal(s) with open opportunities`);
    evidence.push(`${openDeals} open deals, ${staleDeals} stale`);
  } else if (openDeals > 0) {
    score += 8;
    reasons.push(`${openDeals} open deal(s)`);
    evidence.push(`${openDeals} active opportunities`);
  }

  if (totalActivities > 0 && daysSinceLastActivity && daysSinceLastActivity > 14) {
    score += 5;
    reasons.push("Historical engagement but recent decline");
    evidence.push(`${totalActivities} past interactions but none recently`);
  }

  if (daysSinceLastActivity && daysSinceLastActivity <= 7) {
    score -= 10;
    reasons.push("Recent engagement");
    evidence.push(`Last activity ${daysSinceLastActivity} days ago`);
  }

  if (openDeals === 0 && totalActivities > 5) {
    score += 10;
    reasons.push("Active communication but no active deals");
    evidence.push(`${totalActivities} interactions but no open deals`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priorityLevel = toPriorityLevel(priorityScore);

  let recommendedAction = "Continue current engagement rhythm";
  if (daysSinceLastActivity && daysSinceLastActivity > 30 && openDeals > 0) {
    recommendedAction = "Re-engage immediately — active deals with no contact for 30+ days";
  } else if (overdueTasks > 0 && openDeals > 0) {
    recommendedAction = "Complete overdue tasks and schedule follow-up with active deals";
  } else if (overdueTasks > 0) {
    recommendedAction = "Complete overdue follow-up tasks to restore engagement";
  } else if (daysSinceLastActivity && daysSinceLastActivity > 14 && openDeals > 0) {
    recommendedAction = "Schedule follow-up call to maintain active deal momentum";
  } else if (staleDeals > 0) {
    recommendedAction = "Review and update stale deals to prevent pipeline decay";
  }

  return {
    priorityScore,
    priorityLevel,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
    recommendedAction,
  };
}

/* ------------------------------------------------------------------ */
/* Lead Priority                                                       */
/* ------------------------------------------------------------------ */

interface LeadPriorityInput {
  id: string;
  fullName: string | null;
  stage: string | null;
  probabilityPct: number | null;
  createdAt: string | null;
}

function getLeadPriority(lead: LeadPriorityInput): PriorityResult {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];
  const reasons: string[] = [];
  const evidence: string[] = [];
  let score = 0;

  const ageDays = lead.createdAt ? daysBetween(lead.createdAt, now) : null;

  const lastActivity = safeGet(
    () =>
      db
        .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`)
        .get(lead.id) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
        .get(lead.id) as { c: number },
    { c: 0 }
  ).c;

  const openDeals = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.deals} WHERE lead_id = ? AND deleted_at IS NULL`)
        .get(lead.id) as { c: number },
    { c: 0 }
  ).c;

  if (ageDays && ageDays > 30) {
    score += 15;
    reasons.push(`Lead is ${ageDays} days old`);
    evidence.push(`Created ${ageDays} days ago`);
  }

  if (lead.probabilityPct !== null && lead.probabilityPct >= 70) {
    score += 15;
    reasons.push("High conversion probability");
    evidence.push(`CRM probability: ${lead.probabilityPct}%`);
  } else if (lead.probabilityPct !== null && lead.probabilityPct >= 40) {
    score += 8;
    reasons.push("Moderate conversion probability");
    evidence.push(`CRM probability: ${lead.probabilityPct}%`);
  }

  if (lead.stage === "Qualified" || lead.stage === "Proposal") {
    score += 10;
    reasons.push(`Advanced stage: ${lead.stage}`);
    evidence.push(`Currently in ${lead.stage} stage`);
  }

  if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    score += 20;
    reasons.push(`No activity for ${daysSinceLastActivity} days`);
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  } else if (daysSinceLastActivity && daysSinceLastActivity > 7) {
    score += 10;
    reasons.push("Activity declining");
    evidence.push(`Last activity: ${daysSinceLastActivity} days ago`);
  }

  if (overdueTasks > 0) {
    score += 20;
    reasons.push(`${overdueTasks} overdue follow-up task(s)`);
    evidence.push(`${overdueTasks} overdue task(s)`);
  }

  if (openDeals > 0) {
    score += 10;
    reasons.push(`${openDeals} open deal(s)`);
    evidence.push(`${openDeals} deal(s) in progress`);
  }

  if (lead.stage === "junk" || lead.stage === "lost") {
    score -= 20;
    reasons.push("Lead is disqualified");
    evidence.push(`Stage: ${lead.stage}`);
  }

  const priorityScore = clamp(score, 0, 100);
  const priorityLevel = toPriorityLevel(priorityScore);

  let recommendedAction = "Continue nurturing this lead";
  if (daysSinceLastActivity && daysSinceLastActivity > 14) {
    recommendedAction = "Schedule follow-up call immediately to re-engage cold lead";
  } else if (overdueTasks > 0) {
    recommendedAction = "Complete overdue follow-up tasks to restore engagement rhythm";
  } else if (lead.stage === "Qualified" && openDeals === 0) {
    recommendedAction = "Convert qualified lead into a formal deal";
  }

  return {
    priorityScore,
    priorityLevel,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
    recommendedAction,
  };
}

/* ------------------------------------------------------------------ */
/* Task Priority                                                       */
/* ------------------------------------------------------------------ */

interface TaskPriorityInput {
  id: string;
  title: string | null;
  entityType: string | null;
  entityId: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

function getTaskPriority(task: TaskPriorityInput): PriorityResult {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];
  const reasons: string[] = [];
  const evidence: string[] = [];
  let score = 0;

  const isOverdue = task.completedAt === null && task.dueAt && new Date(task.dueAt) < new Date();
  const daysOverdue = isOverdue ? daysBetween(now, task.dueAt) : null;
  const daysUntilDue = !isOverdue && task.dueAt ? daysBetween(now, task.dueAt) : null;

  let relatedRecordValueMinor: number | null = null;
  let relatedRecordStage: string | null = null;
  let relatedRecordDaysSinceActivity: number | null = null;

  if (task.entityType === "deal" && task.entityId) {
    const deal = safeGet(
      () =>
        db
          .prepare(`SELECT expected_value_minor, stage_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`)
          .get(task.entityId) as { expected_value_minor: number | null; stage_id: string | null } | undefined,
      undefined
    );
    if (deal) {
      relatedRecordValueMinor = deal.expected_value_minor;
      if (deal.stage_id) {
        const stage = safeGet(
          () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(deal.stage_id) as { label: string | null } | undefined,
          undefined
        );
        relatedRecordStage = stage?.label ?? null;
      }
    }
    const lastAct = safeGet(
      () =>
        db
          .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
          .get(task.entityId) as { last: string | null },
      { last: null }
    ).last;
    if (lastAct) relatedRecordDaysSinceActivity = daysBetween(lastAct, now);
  } else if (task.entityType === "lead" && task.entityId) {
    const lead = safeGet(
      () =>
        db
          .prepare(`SELECT stage_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`)
          .get(task.entityId) as { stage_id: string | null } | undefined,
      undefined
    );
    if (lead?.stage_id) {
      const stage = safeGet(
        () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(lead.stage_id) as { label: string | null } | undefined,
        undefined
      );
      relatedRecordStage = stage?.label ?? null;
    }
    const lastAct = safeGet(
      () =>
        db
          .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ?`)
          .get(task.entityId) as { last: string | null },
      { last: null }
    ).last;
    if (lastAct) relatedRecordDaysSinceActivity = daysBetween(lastAct, now);
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
  const priorityLevel = toPriorityLevel(priorityScore);

  let recommendedAction = "Complete the task";
  if (isOverdue && relatedRecordValueMinor && relatedRecordValueMinor > 100000) {
    recommendedAction = "Complete immediately — overdue task linked to high-value deal";
  } else if (isOverdue) {
    recommendedAction = "Complete immediately — task is overdue";
  } else if (daysUntilDue !== null && daysUntilDue < 3) {
    recommendedAction = "Complete today — due very soon";
  }

  return {
    priorityScore,
    priorityLevel,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
    recommendedAction,
  };
}

/* ------------------------------------------------------------------ */
/* Pattern Detection                                                   */
/* ------------------------------------------------------------------ */

export interface CRMPattern {
  id: string;
  type: "deal_stall" | "customer_decline" | "high_value_low_activity" | "owner_overload" | "lead_aging" | "multiple_opportunities_inactive" | "repeated_followup_failures" | "stage_duration_anomaly";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  entityIds: string[];
  evidence: string[];
  recommendedAction: string;
}

export function detectCRMPatterns(): CRMPattern[] {
  const db = getDb();
  const patterns: CRMPattern[] = [];

  const staleDeals = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, d.expected_value_minor, d.establishment_id, d.stage_id,
                  CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS days_since_update,
                  CAST(julianday('now') - julianday(d.created_at) AS INTEGER) AS age_days
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND (s.is_terminal IS NULL OR s.is_terminal = 0)
             AND (d.updated_at IS NULL OR d.updated_at < date('now', '-14 days'))
           ORDER BY days_since_update DESC`
        )
        .all() as Array<{
          id: string;
          name: string | null;
          expected_value_minor: number | null;
          establishment_id: string | null;
          stage_id: string | null;
          days_since_update: number;
          age_days: number;
        }>
  );

  const qualifiedStalled = staleDeals.filter((d) => {
    if (!d.stage_id) return false;
    const stage = safeGet(
      () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(d.stage_id) as { label: string | null } | undefined,
      undefined
    );
    return stage?.label === "Qualified" && d.days_since_update > 14;
  });

  if (qualifiedStalled.length > 0) {
    const ids = qualifiedStalled.map((d) => d.id);
    const names = qualifiedStalled.map((d) => d.name || d.id).slice(0, 5).join(", ");
    patterns.push({
      id: "pattern-qualified-stall",
      type: "deal_stall",
      severity: qualifiedStalled.length > 2 ? "critical" : "warning",
      title: `${qualifiedStalled.length} deal(s) stalled in Qualified stage`,
      description: `Deals are repeatedly stalling in the Qualified stage without progression. This indicates a bottleneck in the qualification-to-proposal transition.`,
      entityIds: ids,
      evidence: [`${qualifiedStalled.length} deals stuck in Qualified`, `Average stall duration: ${Math.round(qualifiedStalled.reduce((s, d) => s + d.days_since_update, 0) / qualifiedStalled.length)} days`, names],
      recommendedAction: "Review Qualified stage deals — identify blockers and advance to Proposal or close if unqualified",
    });
  }

  const highValueStale = staleDeals.filter((d) => d.expected_value_minor && d.expected_value_minor > 200000);
  if (highValueStale.length > 0) {
    const ids = highValueStale.map((d) => d.id);
    patterns.push({
      id: "pattern-high-value-stale",
      type: "high_value_low_activity",
      severity: "critical",
      title: `${highValueStale.length} high-value deal(s) with low activity`,
      description: "High-value deals have stalled without recent activity, representing significant revenue risk.",
      entityIds: ids,
      evidence: highValueStale.slice(0, 3).map((d) => `${d.name || d.id}: ${(d.expected_value_minor! / 100).toFixed(2)} SAR, stale for ${d.days_since_update} days`),
      recommendedAction: "Immediately re-engage stakeholders on stalled high-value deals",
    });
  }

  const overloadedOwners = safeAll(
    () =>
      db
        .prepare(
          `SELECT u.id, u.name, COUNT(t.id) AS overdue_count
           FROM ${TABLES.users} u
           JOIN ${TABLES.tasks} t ON t.assignee_id = u.id
           WHERE t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now')
           GROUP BY u.id
           HAVING overdue_count >= 5
           ORDER BY overdue_count DESC`
        )
        .all() as Array<{ id: string; name: string | null; overdue_count: number }>
  );

  if (overloadedOwners.length > 0) {
    const ids = overloadedOwners.map((o) => o.id);
    patterns.push({
      id: "pattern-owner-overload",
      type: "owner_overload",
      severity: "warning",
      title: `${overloadedOwners.length} owner(s) with 5+ overdue tasks`,
      description: "Team members have unusually high overdue task counts, which may indicate workload imbalance or blockers.",
      entityIds: ids,
      evidence: overloadedOwners.map((o) => `${o.name || "Unknown"}: ${o.overdue_count} overdue tasks`),
      recommendedAction: "Review workload distribution and reassign tasks where possible",
    });
  }

  const staleLeads = safeAll(
    () =>
      db
        .prepare(
          `SELECT l.id, l.full_name, l.stage_id,
                  CAST(julianday('now') - julianday(COALESCE(l.updated_at, l.created_at)) AS INTEGER) AS days_since_update
           FROM ${TABLES.leads} l
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
             AND (l.updated_at IS NULL OR l.updated_at < date('now', '-14 days'))
           ORDER BY days_since_update DESC
           LIMIT 10`
        )
        .all() as Array<{ id: string; full_name: string | null; stage_id: string | null; days_since_update: number }>
  );

  const newStageLeads = staleLeads.filter((l) => {
    if (!l.stage_id) return true;
    const stage = safeGet(
      () => db.prepare(`SELECT label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(l.stage_id) as { label: string | null } | undefined,
      undefined
    );
    return stage?.label === "New" || stage?.label === null;
  });

  if (newStageLeads.length > 0) {
    const ids = newStageLeads.map((l) => l.id);
    patterns.push({
      id: "pattern-lead-aging",
      type: "lead_aging",
      severity: "warning",
      title: `${newStageLeads.length} lead(s) remaining too long in New stage`,
      description: "Leads are staying in the New stage for extended periods without progression, indicating qualification delays.",
      entityIds: ids,
      evidence: newStageLeads.slice(0, 5).map((l) => `${l.full_name || l.id}: ${l.days_since_update} days in pipeline`),
      recommendedAction: "Review and qualify aging leads — move to appropriate stage or disqualify",
    });
  }

  const multiOpportunityInactive = safeAll(
    () =>
      db
        .prepare(
          `SELECT e.id, e.name, COUNT(DISTINCT d.id) AS open_deals,
                   MAX(a.occurred_at) AS last_activity
            FROM ${TABLES.customers} e
            LEFT JOIN ${TABLES.deals} d ON d.establishment_id = e.id AND d.deleted_at IS NULL
            LEFT JOIN ${TABLES.activities} a ON (
              (a.entity_type = 'establishment' AND a.entity_id = e.id)
              OR (a.entity_type = 'deal' AND a.entity_id = d.id)
              OR (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = e.id AND deleted_at IS NULL))
            )
            WHERE e.deleted_at IS NULL
            GROUP BY e.id
            HAVING open_deals >= 2 AND (last_activity IS NULL OR last_activity < date('now', '-21 days'))
            LIMIT 10`
        )
        .all() as Array<{ id: string; name: string | null; open_deals: number; last_activity: string | null }>
  );

  if (multiOpportunityInactive.length > 0) {
    const ids = multiOpportunityInactive.map((c) => c.id);
    patterns.push({
      id: "pattern-multi-opportunity-inactive",
      type: "multiple_opportunities_inactive",
      severity: "warning",
      title: `${multiOpportunityInactive.length} customer(s) with multiple open deals but no recent activity`,
      description: "Customers with multiple open opportunities have gone silent, risking multiple deals simultaneously.",
      entityIds: ids,
      evidence: multiOpportunityInactive.slice(0, 5).map((c) => `${c.name || c.id}: ${c.open_deals} open deals, last activity ${c.last_activity || "never"}`),
      recommendedAction: "Prioritize re-engagement for customers with multiple at-risk opportunities",
    });
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Loss Patterns                                                      */
/* ------------------------------------------------------------------ */

export interface LossPattern {
  id: string;
  type: "stage_loss" | "value_loss" | "source_loss" | "inactivity_loss" | "overdue_loss";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence: string[];
  sampleSize: number;
  confidence: "high" | "medium" | "low";
  businessImpact: string;
}

export function detectLossPatterns(): LossPattern[] {
  const db = getDb();
  const patterns: LossPattern[] = [];

  const lostWithInactivity = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, d.expected_value_minor,
                   CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER) AS days_inactive
            FROM ${TABLES.deals} d
            LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
            WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost'
              AND (d.updated_at IS NULL OR julianday('now') - julianday(d.updated_at) > 14)
            LIMIT 10`
        )
        .all() as Array<{ id: string; name: string | null; expected_value_minor: number | null; days_inactive: number }>
  );

  if (lostWithInactivity.length > 0) {
    patterns.push({
      id: "pattern-inactivity-loss",
      type: "inactivity_loss",
      severity: lostWithInactivity.length > 3 ? "critical" : "warning",
      title: `${lostWithInactivity.length} lost deal(s) showed inactivity before loss`,
      description: `Deals that became inactive before being lost indicate a pattern where lack of follow-up leads to deal death.`,
      evidence: lostWithInactivity.slice(0, 3).map((d) => `${d.name || d.id}: inactive for ${d.days_inactive} days`),
      sampleSize: lostWithInactivity.length,
      confidence: lostWithInactivity.length >= 5 ? "high" : "medium",
      businessImpact: `Proactive follow-up could have saved some of these deals`,
    });
  }

  const highValueLost = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, d.expected_value_minor, s.label AS stage
            FROM ${TABLES.deals} d
            LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
            WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost'
              AND d.expected_value_minor > 200000
            LIMIT 10`
        )
        .all() as Array<{ id: string; name: string | null; expected_value_minor: number | null; stage: string | null }>
  );

  if (highValueLost.length > 0) {
    patterns.push({
      id: "pattern-high-value-loss",
      type: "value_loss",
      severity: "critical",
      title: `${highValueLost.length} high-value deal(s) were lost`,
      description: `Losing high-value deals has significant revenue impact. Review the qualification and closing process for these opportunities.`,
      evidence: highValueLost.slice(0, 3).map((d) => `${d.name || d.id}: ${(d.expected_value_minor! / 100).toFixed(2)} SAR in ${d.stage || "unknown"}`),
      sampleSize: highValueLost.length,
      confidence: highValueLost.length >= 3 ? "high" : "medium",
      businessImpact: `Total lost value: ${(highValueLost.reduce((sum, d) => sum + (d.expected_value_minor || 0), 0) / 100).toFixed(2)} SAR`,
    });
  }

  const sourceLoss = safeAll(
    () =>
      db
        .prepare(
          `SELECT src.name AS source, COUNT(*) AS total,
                  SUM(CASE WHEN s.terminal_type = 'lost' THEN 1 ELSE 0 END) AS lost
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           LEFT JOIN ${TABLES.sources} src ON src.id = d.primary_source_id
           WHERE d.deleted_at IS NULL AND d.primary_source_id IS NOT NULL
           GROUP BY d.primary_source_id, src.name
           HAVING total > 0
           ORDER BY lost DESC
           LIMIT 5`
        )
        .all() as Array<{ source: string | null; total: number; lost: number }>
  );

  const badSources = sourceLoss.filter((s) => s.total >= 3 && s.lost > 0 && (s.lost / s.total) > 0.5);
  if (badSources.length > 0) {
    patterns.push({
      id: "pattern-source-loss",
      type: "source_loss",
      severity: "warning",
      title: `${badSources.length} lead source(s) with high loss rate`,
      description: `Leads from these sources are frequently lost. Consider reviewing lead quality or nurturing workflows for these channels.`,
      evidence: badSources.slice(0, 3).map((s) => `${s.source}: ${s.lost}/${s.total} lost (${Math.round((s.lost / s.total) * 100)}%)`),
      sampleSize: badSources.reduce((sum, s) => sum + s.total, 0),
      confidence: badSources[0].total >= 5 ? "high" : "medium",
      businessImpact: `Lead quality from these sources may need improvement`,
    });
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Conversion Patterns                                                 */
/* ------------------------------------------------------------------ */

export interface ConversionPattern {
  id: string;
  type: "stage_conversion" | "quick_conversion" | "slow_conversion" | "source_conversion";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence: string[];
  sampleSize: number;
  confidence: "high" | "medium" | "low";
  businessImpact: string;
}

export function detectConversionPatterns(): ConversionPattern[] {
  const db = getDb();
  const patterns: ConversionPattern[] = [];

  const quickWins = safeAll(
    () =>
      db
        .prepare(
          `SELECT d.id, d.name, d.expected_value_minor,
                   CAST(julianday(d.updated_at) - julianday(d.created_at) AS INTEGER) AS days_to_close
            FROM ${TABLES.deals} d
            LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
            WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'
              AND julianday(d.updated_at) - julianday(d.created_at) <= 14
            LIMIT 10`
        )
        .all() as Array<{ id: string; name: string | null; expected_value_minor: number | null; days_to_close: number }>
  );

  if (quickWins.length > 0) {
    patterns.push({
      id: "pattern-quick-conversion",
      type: "quick_conversion",
      severity: "info",
      title: `${quickWins.length} deal(s) closed within 14 days`,
      description: `These deals closed quickly, indicating strong initial qualification and fast decision-making.`,
      evidence: quickWins.slice(0, 3).map((d) => `${d.name || d.id}: closed in ${d.days_to_close} days`),
      sampleSize: quickWins.length,
      confidence: quickWins.length >= 3 ? "high" : "medium",
      businessImpact: `Analyze these deals to identify quick-close characteristics`,
    });
  }

  return patterns;
}

/* ------------------------------------------------------------------ */
/* Stage Bottlenecks                                                    */
/* ------------------------------------------------------------------ */

export interface StageBottleneck {
  id: string;
  stage: string;
  stageColor: string | null;
  totalDeals: number;
  avgDaysInStage: number;
  stalledDeals: number;
  bottleneckScore: number;
  severity: "info" | "warning" | "critical";
  recommendation: string;
}

export function detectStageBottlenecks(): StageBottleneck[] {
  const db = getDb();

  const stages = safeAll(
    () =>
      db
        .prepare(
          `SELECT s.id, s.label, s.color, s.sort_order,
                  COUNT(*) AS total,
                  AVG(CAST(julianday('now') - julianday(COALESCE(d.updated_at, d.created_at)) AS INTEGER)) AS avg_days,
                  SUM(CASE WHEN d.updated_at IS NULL OR d.updated_at < date('now', '-14 days') THEN 1 ELSE 0 END) AS stalled
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.deleted_at IS NULL AND (s.is_terminal IS NULL OR s.is_terminal = 0)
           GROUP BY s.id, s.label, s.color, s.sort_order
           HAVING total > 0
           ORDER BY avg_days DESC`
        )
        .all() as Array<{
          id: string;
          label: string | null;
          color: string | null;
          sort_order: number | null;
          total: number;
          avg_days: number | null;
          stalled: number;
        }>
  );

  return stages.map((s) => {
    const avgDays = s.avg_days ?? 0;
    const stalledRate = s.total > 0 ? s.stalled / s.total : 0;
    const bottleneckScore = Math.round((avgDays * 2) + (stalledRate * 50));

    let severity: StageBottleneck["severity"] = "info";
    if (bottleneckScore >= 60 || avgDays > 30) severity = "critical";
    else if (bottleneckScore >= 30 || avgDays > 14) severity = "warning";

    let recommendation = "Monitor deals in this stage";
    if (avgDays > 30) {
      recommendation = "Review why deals are stuck in this stage for extended periods";
    } else if (stalledRate > 0.3) {
      recommendation = "High stalling rate - review qualification criteria for this stage";
    }

    return {
      id: `bottleneck-${s.id}`,
      stage: s.label || "Unknown",
      stageColor: s.color,
      totalDeals: s.total,
      avgDaysInStage: Math.round(avgDays),
      stalledDeals: s.stalled,
      bottleneckScore,
      severity,
      recommendation,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function getDailyBriefing(): DailyBriefing {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0];

  const allItems: Array<{
    entityType: "deal" | "customer" | "lead" | "task";
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
        .all() as DealPriorityInput[]
  );
  const uniqueDeals = Array.from(
    new Map(deals.map((d) => [d.id, d])).values()
  );

  for (const deal of uniqueDeals) {
    const priority = getDealPriority(deal);
    allItems.push({
      entityType: "deal",
      entityId: deal.id,
      entityName: deal.name || deal.company || "Untitled Deal",
      priority: priority.priorityLevel,
      priorityScore: priority.priorityScore,
      reason: priority.reasons.join("; "),
      evidence: priority.evidence,
      recommendedAction: priority.recommendedAction,
      value: deal.expectedValueMinor ?? undefined,
      currency: "SAR",
    });
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
    const priority = getCustomerPriority(customer);
    allItems.push({
      entityType: "customer",
      entityId: customer.id,
      entityName: customer.name || "Unknown",
      priority: priority.priorityLevel,
      priorityScore: priority.priorityScore,
      reason: priority.reasons.join("; "),
      evidence: priority.evidence,
      recommendedAction: priority.recommendedAction,
    });
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
        .all() as LeadPriorityInput[]
  );
  const uniqueLeads = Array.from(
    new Map(leads.map((l) => [l.id, l])).values()
  );

  for (const lead of uniqueLeads) {
    const priority = getLeadPriority(lead);
    allItems.push({
      entityType: "lead",
      entityId: lead.id,
      entityName: lead.fullName || "Unknown Lead",
      priority: priority.priorityLevel,
      priorityScore: priority.priorityScore,
      reason: priority.reasons.join("; "),
      evidence: priority.evidence,
      recommendedAction: priority.recommendedAction,
    });
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
        .all() as TaskPriorityInput[]
  );

  for (const task of tasks) {
    const priority = getTaskPriority(task);
    allItems.push({
      entityType: "task",
      entityId: task.id,
      entityName: task.title || "Untitled Task",
      priority: priority.priorityLevel,
      priorityScore: priority.priorityScore,
      reason: priority.reasons.join("; "),
      evidence: priority.evidence,
      recommendedAction: priority.recommendedAction,
    });
  }

  allItems.sort((a, b) => b.priorityScore - a.priorityScore);

  const todayPriorities = allItems
    .filter((item) => item.priorityScore >= 40)
    .slice(0, 10)
    .map((item) => ({
      entityType: item.entityType as DailyBriefing["todayPriorities"][0]["entityType"],
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["todayPriorities"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      value: item.value,
      currency: item.currency,
    }));

  const atRiskDeals = allItems
    .filter((item) => item.entityType === "deal" && item.priorityScore >= 50)
    .slice(0, 10)
    .map((item) => ({
      entityType: "deal" as const,
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["atRiskDeals"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      riskScore: item.priorityScore,
      riskLevel: item.priority as DailyBriefing["atRiskDeals"][0]["riskLevel"],
      expectedValueMinor: item.value ?? null,
      currencyCode: item.currency ?? null,
    }));

  const customersRequiringAttention = allItems
    .filter((item) => item.entityType === "customer" && item.priorityScore >= 50)
    .slice(0, 10)
    .map((item) => ({
      entityType: "customer" as const,
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["customersRequiringAttention"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      daysSinceActivity: item.daysSinceActivity ?? null,
      openDeals: item.openDeals ?? 0,
    }));

  const overdueTasks = allItems
    .filter((item) => item.entityType === "task" && item.priorityScore >= 30)
    .slice(0, 10)
    .map((item) => ({
      entityType: "task" as const,
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["overdueTasks"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      daysOverdue: item.daysOverdue ?? 0,
      relatedRecordValueMinor: item.relatedRecordValueMinor ?? null,
    }));

  const suggestedFollowUps = allItems
    .filter((item) => {
      if (item.entityType === "customer" || item.entityType === "lead") {
        return item.priorityScore >= 40 && (item.reason.includes("No activity") || item.reason.includes("inactive") || item.reason.includes("cold"));
      }
      if (item.entityType === "deal") {
        return item.priorityScore >= 50 && (item.reason.includes("stalled") || item.reason.includes("No recent activity"));
      }
      return false;
    })
    .slice(0, 10)
    .map((item) => ({
      entityType: item.entityType as DailyBriefing["suggestedFollowUps"][0]["entityType"],
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["suggestedFollowUps"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      daysSinceActivity: item.daysSinceActivity ?? null,
    }));

  const opportunities = allItems
    .filter((item) => {
      if (item.entityType === "deal") {
        return item.priorityScore >= 40 && (item.value ?? 0) > 50000;
      }
      if (item.entityType === "lead") {
        return item.priorityScore >= 40 && (item.reason.includes("Advanced stage") || item.reason.includes("High conversion probability"));
      }
      return false;
    })
    .slice(0, 10)
    .map((item) => ({
      entityType: item.entityType as DailyBriefing["opportunities"][0]["entityType"],
      entityId: item.entityId,
      entityName: item.entityName,
      priority: item.priority as DailyBriefing["opportunities"][0]["priority"],
      priorityScore: item.priorityScore,
      reason: item.reason,
      evidence: item.evidence,
      recommendedAction: item.recommendedAction,
      expectedValueMinor: item.value ?? null,
    }));

  const executiveSummaryParts: string[] = [];
  const totalPriorityItems = todayPriorities.length;
  const totalAtRisk = atRiskDeals.length;
  const totalOverdue = overdueTasks.length;
  const totalInactive = customersRequiringAttention.length;

  if (totalAtRisk > 0) {
    const highValueAtRisk = atRiskDeals.filter((d) => (d.expectedValueMinor ?? 0) > 100000).length;
    executiveSummaryParts.push(`${totalAtRisk} at-risk deal(s) detected, ${highValueAtRisk} of which are high-value`);
  }
  if (totalOverdue > 0) {
    executiveSummaryParts.push(`${totalOverdue} overdue task(s) require immediate attention`);
  }
  if (totalInactive > 0) {
    executiveSummaryParts.push(`${totalInactive} customer(s) need re-engagement`);
  }
  if (suggestedFollowUps.length > 0) {
    executiveSummaryParts.push(`${suggestedFollowUps.length} follow-up opportunity(ies) identified`);
  }
  if (opportunities.length > 0) {
    const oppValue = opportunities.reduce((s, o) => s + (o.expectedValueMinor ?? 0), 0);
    executiveSummaryParts.push(`${opportunities.length} opportunity(ies) worth ${(oppValue / 100).toFixed(2)} SAR identified`);
  }
  if (totalPriorityItems > 0) {
    executiveSummaryParts.push(`${totalPriorityItems} priority item(s) for today`);
  }

  const employeeOverdue = overdueTasks.filter((t) => t.priorityScore >= 50).length;
  const employeeHighPriorityDeals = atRiskDeals.filter((d) => d.priorityScore >= 60).length;
  const employeeCustomersNeedingAttention = customersRequiringAttention.filter((c) => c.priorityScore >= 60).length;
  const employeeLeadsNeedingFollowUp = suggestedFollowUps.filter((f) => f.entityType === "lead").length;

  const employeeRecommendedActions: string[] = [];
  if (employeeOverdue > 0) {
    employeeRecommendedActions.push(`Complete ${employeeOverdue} overdue task(s)`);
  }
  if (employeeHighPriorityDeals > 0) {
    employeeRecommendedActions.push(`Address ${employeeHighPriorityDeals} high-priority deal(s)`);
  }
  if (employeeCustomersNeedingAttention > 0) {
    employeeRecommendedActions.push(`Re-engage ${employeeCustomersNeedingAttention} customer(s)`);
  }
  if (employeeLeadsNeedingFollowUp > 0) {
    employeeRecommendedActions.push(`Follow up on ${employeeLeadsNeedingFollowUp} lead(s)`);
  }
  if (employeeRecommendedActions.length === 0) {
    employeeRecommendedActions.push("Continue current momentum — no urgent actions required");
  }

  return {
    executiveSummary: executiveSummaryParts.join(". ") + ".",
    todayPriorities,
    atRiskDeals,
    customersRequiringAttention,
    overdueTasks,
    suggestedFollowUps,
    opportunities,
    employeeSummary: {
      overdueTasks: totalOverdue,
      todayTasks: tasks.filter((t) => t.dueAt && new Date(t.dueAt) < new Date(now + "T23:59:59")).length,
      highPriorityDeals: employeeHighPriorityDeals,
      customersNeedingAttention: employeeCustomersNeedingAttention,
      leadsNeedingFollowUp: employeeLeadsNeedingFollowUp,
      recommendedActions: employeeRecommendedActions,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Win Probability with Historical Data                                */
/* ------------------------------------------------------------------ */

export interface WinProbabilityResult {
  winProbability: number;
  confidence: "high" | "medium" | "low";
  historicalBaseline: number | null;
  currentSignalAdjustment: number;
  positiveFactors: string[];
  negativeFactors: string[];
  explanation: string;
}

export function calculateWinProbabilityWithHistory(dealId: string): WinProbabilityResult | null {
  const db = getDb();
  const deal = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.*, s.label AS stage_label, s.is_terminal, s.terminal_type
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.id = ? AND d.deleted_at IS NULL
           LIMIT 1`
        )
        .get() as Record<string, unknown>,
    null
  );

  if (!deal) return null;

  const now = new Date().toISOString().split("T")[0];
  const stageLabel = deal.stage_label as string | null;
  const daysSinceUpdate = deal.updated_at ? daysBetween(deal.updated_at as string, now) : null;

  const historicalBaseline = calculateStageConversionRate(stageLabel);

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  let adjustment = 0;

  if (historicalBaseline !== null) {
    positiveFactors.push(`Historical conversion rate for ${stageLabel || "unknown"}: ${historicalBaseline}%`);
  }

  const totalActivities = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const lastActivity = safeGet(
    () =>
      db
        .prepare(`SELECT MAX(occurred_at) AS last FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ?`)
        .get(dealId) as { last: string | null },
    { last: null }
  ).last;
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, now) : null;

  const overdueTasks = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS c FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? AND completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')`)
        .get(dealId) as { c: number },
    { c: 0 }
  ).c;

  const isStalled = (daysSinceLastActivity !== null && daysSinceLastActivity > 14) ||
    (daysSinceUpdate !== null && daysSinceUpdate > 14);

  if (totalActivities >= 5) {
    adjustment += 10;
    positiveFactors.push(`${totalActivities} interactions recorded`);
  } else if (totalActivities === 0) {
    adjustment -= 10;
    negativeFactors.push("No recorded interactions");
  }

  if (daysSinceLastActivity !== null && daysSinceLastActivity <= 7) {
    adjustment += 10;
    positiveFactors.push("Recent activity (≤7 days)");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
    adjustment -= 15;
    negativeFactors.push("No activity for 21+ days");
  } else if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    adjustment -= 10;
    negativeFactors.push(`No activity for ${daysSinceLastActivity} days`);
  }

  if (overdueTasks > 0) {
    adjustment -= 5 * overdueTasks;
    negativeFactors.push(`${overdueTasks} overdue task(s)`);
  }

  if (isStalled) {
    adjustment -= 10;
    negativeFactors.push("Deal appears stalled");
  }

  const probabilityPct = (deal.probability_pct as number | null) ?? null;
  if (probabilityPct !== null) {
    adjustment += Math.round((probabilityPct - 50) * 0.2);
    if (probabilityPct >= 70) {
      positiveFactors.push(`High CRM probability: ${probabilityPct}%`);
    } else if (probabilityPct < 20) {
      negativeFactors.push(`Low CRM probability: ${probabilityPct}%`);
    }
  }

  const baseScore = historicalBaseline !== null ? historicalBaseline : 50;
  const winProbability = clamp(Math.round(baseScore + adjustment), 0, 100);

  const totalSignals = positiveFactors.length + negativeFactors.length;
  const confidence: "high" | "medium" | "low" = historicalBaseline !== null && totalSignals >= 4 ? "high"
    : historicalBaseline !== null && totalSignals >= 2 ? "medium"
    : "low";

  const explanation = `Win probability is ${winProbability}% (${confidence} confidence). ` +
    (historicalBaseline !== null
      ? `Historical baseline for ${stageLabel || "this stage"}: ${historicalBaseline}%. `
      : "Insufficient historical data for baseline. ") +
    `Current signals: ${positiveFactors.length} positive, ${negativeFactors.length} negative. ` +
    (positiveFactors.length > 0 ? `Positive: ${positiveFactors.slice(0, 3).join(", ")}. ` : "") +
    (negativeFactors.length > 0 ? `Negative: ${negativeFactors.slice(0, 3).join(", ")}.` : "");

  return {
    winProbability,
    confidence,
    historicalBaseline,
    currentSignalAdjustment: adjustment,
    positiveFactors,
    negativeFactors,
    explanation,
  };
}

function calculateStageConversionRate(stageLabel: string | null): number | null {
  if (!stageLabel) return null;

  const db = getDb();
  const stageRow = safeGet(
    () =>
      db
        .prepare(`SELECT id, is_terminal, terminal_type FROM ${TABLES.stages} WHERE label = ? AND pipeline = 'deal' LIMIT 1`)
        .get(stageLabel) as { id: string; is_terminal: number | null; terminal_type: string | null } | undefined,
    undefined
  );
  if (!stageRow || !stageRow.is_terminal) return null;

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

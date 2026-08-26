import { getDb } from "@/lib/db";
import { TABLES, MINOR_UNIT } from "@/lib/definitions";
import { getEntityEvents } from "@/services/event.service";
import type { CrmEvent, EntityType } from "@/types/events";
import type {
  DecisionAnalysis,
  DecisionEvidence,
  DecisionQueryInput,
  DecisionResult,
  DecisionRuleId,
} from "@/types/decision";

const MAX_EVENTS = 200;
const DEFAULT_OVERDUE_TASK_LIMIT = 20;
const DEFAULT_STAGE_STAGNATION_DAYS = 14;
const DEFAULT_FOLLOWUP_DAYS = 7;
const DEFAULT_OWNER_OVERLOAD = 15;
const DEFAULT_CONTRACT_EXPIRY_DAYS = 30;
const HIGH_VALUE_THRESHOLD_MINOR = 100_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function now(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function safeGet<T>(query: () => T, fallback: T): T {
  try {
    return query();
  } catch {
    return fallback;
  }
}

function getUserName(userId: string | null): string | undefined {
  if (!userId) return undefined;
  const db = getDb();
  const row = safeGet(
    () => db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(userId) as { name: string | null } | undefined,
    undefined
  );
  return row?.name ?? undefined;
}

/* ------------------------------------------------------------------ */
/* Entity type → table name mapping                                    */
/* ------------------------------------------------------------------ */

const ENTITY_TYPE_TO_TABLE: Record<string, string> = {
  customer: TABLES.customers,
  lead: TABLES.leads,
  deal: TABLES.deals,
  task: TABLES.tasks,
  activity: TABLES.activities,
  note: TABLES.notes,
  user: TABLES.users,
  contact: TABLES.contacts,
};

function getTableName(entityType: string): string | undefined {
  return ENTITY_TYPE_TO_TABLE[entityType];
}

function getEntityLabel(entityType: string, entityId: string): string {
  const db = getDb();
  const table = getTableName(entityType);
  if (!table) return `Unnamed ${entityType}`;

  const row = safeGet(
    () =>
      db.prepare(`SELECT name, full_name, title, body FROM ${table} WHERE id = ? LIMIT 1`).get(entityId) as
        | { name: string | null; full_name: string | null; title: string | null; body: string | null }
        | undefined,
    undefined
  );

  if (!row) return `Unnamed ${entityType}`;
  return row.name ?? row.full_name ?? row.title ?? (row.body ?? "").slice(0, 40) ?? `Unnamed ${entityType}`;
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (!a || !b) return 0;
  return Math.floor(Math.abs(a - b) / (1000 * 60 * 60 * 24));
}

function evidence(type: string, description: string, data: Record<string, unknown> = {}): DecisionEvidence {
  return { type, description, data };
}

/* ------------------------------------------------------------------ */
/* Rule evaluators                                                     */
/* ------------------------------------------------------------------ */

interface RuleContext {
  entityType: string;
  entityId: string;
  events: CrmEvent[];
  now: string;
}

function ruleFollowUpOverdue(ctx: RuleContext): DecisionResult | null {
  const interactionEvents = ctx.events.filter(
    (e) =>
      e.event_type === "ACTIVITY_CREATED" ||
      e.event_type === "TASK_CREATED" ||
      e.event_type === "NOTE_CREATED" ||
      e.event_type === "ENTITY_CREATED"
  );

  const lastInteraction = interactionEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const gapDays = lastInteraction ? daysBetween(lastInteraction.timestamp, ctx.now) : 999;

  if (gapDays < DEFAULT_FOLLOWUP_DAYS) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);
  const activityText =
    gapDays === 999 ? "No recent activity available" : `No activity recorded for ${gapDays} days`;

  return {
    ruleId: "follow_up_overdue",
    ruleName: "Follow-up Overdue",
    severity: gapDays > 30 ? "critical" : "warning",
    priority: gapDays > 30 ? "high" : "medium",
    triggered: true,
    description: `${activityText} on ${ctx.entityType} "${label}".`,
    recommendedAction: gapDays > 30 ? "Schedule immediate follow-up or re-qualify the record." : "Schedule a follow-up activity within 24 hours.",
    evidence: [
      evidence("last_activity", activityText, { lastActivityAt: lastInteraction?.timestamp ?? null, gapDays }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleTaskOverdue(ctx: RuleContext): DecisionResult | null {
  const db = getDb();
  const table = getTableName(ctx.entityType);
  if (!table) return null;

  const rows = safeGet(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.due_at, t.assignee_id, u.name AS assignee_name
           FROM ${TABLES.tasks} t
           LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
           WHERE t.entity_type = ? AND t.entity_id = ? AND t.completed_at IS NULL AND t.due_at IS NOT NULL AND t.due_at < ?
           LIMIT ?`
        )
        .all(ctx.entityType, ctx.entityId, ctx.now, DEFAULT_OVERDUE_TASK_LIMIT) as Array<{
      id: string;
      title: string | null;
      due_at: string | null;
      assignee_id: string | null;
      assignee_name: string | null;
    }>,
    []
  );

  if (rows.length === 0) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);
  const taskSummaries = rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.due_at,
    assignee: r.assignee_name ?? getUserName(r.assignee_id),
  }));

  return {
    ruleId: "task_overdue",
    ruleName: "Overdue Tasks",
    severity: rows.length > 3 ? "critical" : "warning",
    priority: rows.length > 3 ? "high" : "medium",
    triggered: true,
    description: `${rows.length} overdue task(s) found on ${ctx.entityType} "${label}".`,
    recommendedAction: rows.length > 3 ? "Prioritize and reassign overdue tasks immediately." : "Complete or reschedule overdue tasks.",
    evidence: [
      evidence("overdue_tasks", `${rows.length} tasks past due date`, { tasks: taskSummaries }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleStageStagnation(ctx: RuleContext): DecisionResult | null {
  const stageEvents = ctx.events
    .filter((e) => e.event_type === "STAGE_CHANGED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (stageEvents.length === 0) return null;

  const currentStageEvent = stageEvents[0];
  const newState = currentStageEvent.new_state as Record<string, unknown> | null;
  const stageId = newState?.stage_id as string | undefined;
  const stageLabel = newState?.stage_label as string | undefined;
  const stagnantDays = daysBetween(currentStageEvent.timestamp, ctx.now);

  if (stagnantDays < DEFAULT_STAGE_STAGNATION_DAYS) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);

  return {
    ruleId: "stage_stagnation",
    ruleName: "Stage Stagnation",
    severity: stagnantDays > 60 ? "critical" : "warning",
    priority: stagnantDays > 60 ? "high" : "medium",
    triggered: true,
    description: `${ctx.entityType} "${label}" has been in stage "${stageLabel ?? stageId ?? "unknown"}" for ${stagnantDays} days.`,
    recommendedAction: stagnantDays > 60 ? "Review and advance or close the stalled record." : "Review progress and determine if the record needs attention or escalation.",
    evidence: [
      evidence("stage_info", `Current stage duration: ${stagnantDays} days`, { stageId, stageLabel, stagnantDays }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleOwnerOverloaded(ctx: RuleContext): DecisionResult | null {
  const db = getDb();
  const table = getTableName(ctx.entityType);
  if (!table) return null;

  const ownerRow = safeGet(
    () => db.prepare(`SELECT owner_id FROM ${table} WHERE id = ? LIMIT 1`).get(ctx.entityId) as { owner_id: string | null } | undefined,
    undefined
  );

  const ownerId = ownerRow?.owner_id;
  if (!ownerId) return null;

  const openDeals = (safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS count FROM ${TABLES.deals} WHERE owner_id = ? AND deleted_at IS NULL AND stage_id NOT IN (SELECT id FROM ${TABLES.stages} WHERE terminal_type IN ('won','lost'))`)
        .get(ownerId) as { count: number } | undefined,
    { count: 0 }
  ) as { count: number }).count;

  const openTasks = (safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS count FROM ${TABLES.tasks} WHERE assignee_id = ? AND completed_at IS NULL`)
        .get(ownerId) as { count: number } | undefined,
    { count: 0 }
  ) as { count: number }).count;

  const total = openDeals + openTasks;
  if (total < DEFAULT_OWNER_OVERLOAD) return null;

  const ownerName = getUserName(ownerId);
  const label = getEntityLabel(ctx.entityType, ctx.entityId);

  return {
    ruleId: "owner_overloaded",
    ruleName: "Owner Overloaded",
    severity: total > DEFAULT_OWNER_OVERLOAD * 2 ? "critical" : "warning",
    priority: "high",
    triggered: true,
    description: `Owner "${ownerName ?? ownerId}" has ${total} open items (${openDeals} deals, ${openTasks} tasks).`,
    recommendedAction: "Consider redistributing some open items to other team members.",
    evidence: [
      evidence("owner_workload", `Owner workload summary`, { ownerId, ownerName, openDeals, openTasks, total }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleValueDecline(ctx: RuleContext): DecisionResult | null {
  if (ctx.entityType !== "deal") return null;

  const creationEvent = ctx.events
    .filter((e) => e.event_type === "DEAL_CREATED")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];

  const valueChangeEvents = ctx.events
    .filter((e) => e.event_type === "VALUE_CHANGED")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const lastValueChange = valueChangeEvents[valueChangeEvents.length - 1];

  let originalValueMinor: number | null = null;
  let currentValueMinor: number | null = null;

  if (creationEvent) {
    const newState = creationEvent.new_state as Record<string, unknown> | null;
    originalValueMinor = (newState?.expected_value_minor as number | undefined) ?? null;
  }

  if (lastValueChange) {
    const newState = lastValueChange.new_state as Record<string, unknown> | null;
    currentValueMinor = (newState?.expected_value_minor as number | undefined) ?? null;
  }

  if (originalValueMinor === null || currentValueMinor === null || originalValueMinor === 0) return null;

  const declinePct = ((originalValueMinor - currentValueMinor) / originalValueMinor) * 100;
  if (declinePct < 10) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);
  const declineMinor = originalValueMinor - currentValueMinor;

  return {
    ruleId: "value_decline",
    ruleName: "Value Decline",
    severity: declinePct > 50 ? "critical" : "warning",
    priority: declinePct > 50 ? "high" : "medium",
    triggered: true,
    description: `Deal "${label}" value declined by ${declinePct.toFixed(1)}% (${(declineMinor / MINOR_UNIT).toFixed(2)} ${"SAR"} drop).`,
    recommendedAction: "Review deal scope and discuss value reduction with the customer.",
    evidence: [
      evidence("value_change", `Original: ${(originalValueMinor / MINOR_UNIT).toFixed(2)}, Current: ${(currentValueMinor / MINOR_UNIT).toFixed(2)}`, {
        originalValueMinor,
        currentValueMinor,
        declinePct,
        declineMinor,
      }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleProbabilityMismatch(ctx: RuleContext): DecisionResult | null {
  if (ctx.entityType !== "deal") return null;

  const stageEvents = ctx.events
    .filter((e) => e.event_type === "STAGE_CHANGED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (stageEvents.length === 0) return null;

  const currentStageEvent = stageEvents[0];
  const newState = currentStageEvent.new_state as Record<string, unknown> | null;
  const probability = (newState?.probability_pct as number | undefined) ?? null;
  const stageLabel = (newState?.stage_label as string | undefined) ?? null;

  if (probability === null) return null;

  const advancedStages = ["proposal", "negotiation", "contract", "closed-won"];
  const earlyStages = ["lead", "qualified", "prospect"];

  const isAdvanced = advancedStages.some((s) => (stageLabel ?? "").toLowerCase().includes(s));
  const isEarly = earlyStages.some((s) => (stageLabel ?? "").toLowerCase().includes(s));

  let triggered = false;
  let severity: "critical" | "warning" | "info" = "info";
  let description = "";
  let recommendedAction = "";

  if (isAdvanced && probability < 30) {
    triggered = true;
    severity = "warning";
    description = `Deal in advanced stage "${stageLabel}" but probability is only ${probability}%.`;
    recommendedAction = "Review deal health and update probability based on current engagement.";
  } else if (isEarly && probability > 80) {
    triggered = true;
    severity = "info";
    description = `Deal in early stage "${stageLabel}" with high probability (${probability}%). Verify qualification accuracy.`;
    recommendedAction = "Validate that the high probability is backed by strong evidence.";
  }

  if (!triggered) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);

  return {
    ruleId: "probability_mismatch",
    ruleName: "Probability Mismatch",
    severity,
    priority: severity === "warning" ? "medium" : "low",
    triggered: true,
    description,
    recommendedAction,
    evidence: [
      evidence("probability_info", `Stage: ${stageLabel}, Probability: ${probability}%`, { stageLabel, probability }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleInactiveCustomer(ctx: RuleContext): DecisionResult | null {
  if (ctx.entityType !== "customer") return null;

  const db = getDb();
  const hasOpenDeals = (safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
           WHERE d.establishment_id = ? AND d.deleted_at IS NULL AND s.terminal_type IS NULL`
        )
        .get(ctx.entityId) as { count: number } | undefined,
    { count: 0 }
  ) as { count: number }).count > 0;

  if (!hasOpenDeals) return null;

  const recentActivity = ctx.events.filter(
    (e) => e.event_type === "ACTIVITY_CREATED" || e.event_type === "TASK_CREATED"
  );
  const lastActivity = recentActivity.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const gapDays = lastActivity ? daysBetween(lastActivity.timestamp, ctx.now) : 999;

  if (gapDays < DEFAULT_FOLLOWUP_DAYS) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);
  const activityText =
    gapDays === 999 ? "No recent activity available" : `No activity for ${gapDays} days`;

  return {
    ruleId: "inactive_customer",
    ruleName: "Inactive Customer with Open Deals",
    severity: gapDays > 30 ? "critical" : "warning",
    priority: "high",
    triggered: true,
    description: `Customer "${label}" has open deals but ${activityText.toLowerCase()}.`,
    recommendedAction: "Re-engage the customer to prevent deal decay.",
    evidence: [
      evidence("activity_gap", activityText, { gapDays, lastActivityAt: lastActivity?.timestamp ?? null }),
      evidence("open_deals", "Customer has open deals", { hasOpenDeals }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleHighValueNoContact(ctx: RuleContext): DecisionResult | null {
  if (ctx.entityType !== "deal") return null;

  const db = getDb();
  const row = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.expected_value_minor, d.establishment_id, e.name AS company_name
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
           WHERE d.id = ? LIMIT 1`
        )
        .get(ctx.entityId) as { expected_value_minor: number | null; company_name: string | null } | undefined,
    undefined
  );

  if (!row || (row.expected_value_minor ?? 0) < HIGH_VALUE_THRESHOLD_MINOR) return null;

  const recentActivity = ctx.events.filter((e) => e.event_type === "ACTIVITY_CREATED");
  const lastActivity = recentActivity.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const gapDays = lastActivity ? daysBetween(lastActivity.timestamp, ctx.now) : 999;

  if (gapDays < 14) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);
  const valueMinor = row.expected_value_minor ?? 0;
  const valueMajor = (valueMinor / MINOR_UNIT).toFixed(2);
  const activityText =
    gapDays === 999 ? "No recent activity available" : `no activity for ${gapDays} days`;

  return {
    ruleId: "high_value_no_contact",
    ruleName: "High-Value Deal with No Recent Contact",
    severity: gapDays > 30 ? "critical" : "warning",
    priority: "high",
    triggered: true,
    description: `Deal "${label}" worth ${valueMajor} ${"SAR"} has ${activityText}.`,
    recommendedAction: "Schedule a high-priority call or meeting with the decision-maker.",
    evidence: [
      evidence("value", `Expected value: ${valueMajor} ${"SAR"}`, { expectedValueMinor: valueMinor }),
      evidence("activity_gap", activityText, { gapDays, lastActivityAt: lastActivity?.timestamp ?? null }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleMissingOwner(ctx: RuleContext): DecisionResult | null {
  const db = getDb();
  const table = getTableName(ctx.entityType);
  if (!table) return null;

  let ownerId: string | null = null;
  let recordExists = false;

  try {
    const row = db.prepare(`SELECT owner_id FROM ${table} WHERE id = ? LIMIT 1`).get(ctx.entityId) as { owner_id: string | null } | undefined;
    if (row) {
      recordExists = true;
      ownerId = row.owner_id;
    }
  } catch {
    // table may not exist in test environment
  }

  if (!recordExists || ownerId) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);

  return {
    ruleId: "missing_owner",
    ruleName: "Missing Owner Assignment",
    severity: "warning",
    priority: "medium",
    triggered: true,
    description: `${ctx.entityType} "${label}" has no assigned owner.`,
    recommendedAction: "Assign an owner to ensure accountability and follow-up.",
    evidence: [
      evidence("owner_check", "owner_id is NULL", { ownerId: null }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

function ruleContractExpiring(ctx: RuleContext): DecisionResult | null {
  if (ctx.entityType !== "deal") return null;

  const db = getDb();
  const row = safeGet(
    () =>
      db
        .prepare(
          `SELECT d.actual_close_date, d.contract_length_months, d.expected_value_minor, e.name AS company_name
           FROM ${TABLES.deals} d
           LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
           WHERE d.id = ? LIMIT 1`
        )
        .get(ctx.entityId) as {
      actual_close_date: string | null;
      contract_length_months: number | null;
      expected_value_minor: number | null;
      company_name: string | null;
    } | undefined,
    undefined
  );

  if (!row || !row.actual_close_date || !row.contract_length_months) return null;

  const contractEnd = new Date(row.actual_close_date);
  contractEnd.setMonth(contractEnd.getMonth() + row.contract_length_months);
  const daysUntilExpiry = daysBetween(ctx.now, contractEnd.toISOString());

  if (daysUntilExpiry < 0 || daysUntilExpiry > DEFAULT_CONTRACT_EXPIRY_DAYS) return null;

  const label = getEntityLabel(ctx.entityType, ctx.entityId);

  return {
    ruleId: "contract_expiring",
    ruleName: "Contract Expiring Soon",
    severity: daysUntilExpiry < 7 ? "critical" : "warning",
    priority: "high",
    triggered: true,
    description: `Deal "${label}" contract expires in ${daysUntilExpiry} days.`,
    recommendedAction: daysUntilExpiry < 7 ? "Initiate renewal discussion immediately." : "Begin renewal outreach and prepare contract extension proposal.",
    evidence: [
      evidence("contract", `Contract expires in ${daysUntilExpiry} days`, {
        actualCloseDate: row.actual_close_date,
        contractLengthMonths: row.contract_length_months,
        daysUntilExpiry,
        expectedValueMinor: row.expected_value_minor,
      }),
      evidence("entity", `Entity: ${ctx.entityType}:${ctx.entityId}`, { label }),
    ],
    affectedEntity: { entityType: ctx.entityType, entityId: ctx.entityId, label },
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

const ALL_RULES: Array<(ctx: RuleContext) => DecisionResult | null> = [
  ruleFollowUpOverdue,
  ruleTaskOverdue,
  ruleStageStagnation,
  ruleOwnerOverloaded,
  ruleValueDecline,
  ruleProbabilityMismatch,
  ruleInactiveCustomer,
  ruleHighValueNoContact,
  ruleMissingOwner,
  ruleContractExpiring,
];

export function evaluateDecisions(input: DecisionQueryInput): DecisionAnalysis {
  const afterDate = daysAgo(90);
  const events = getEntityEvents(input.entityType as EntityType, input.entityId, MAX_EVENTS);
  const recentEvents = events.filter((e) => e.timestamp >= afterDate);

  const ctx: RuleContext = {
    entityType: input.entityType,
    entityId: input.entityId,
    events: recentEvents,
    now: now(),
  };

  const rulesToRun = input.rules
    ? ALL_RULES.filter((_rule, index) => {
        const ruleIds: DecisionRuleId[] = [
          "follow_up_overdue",
          "task_overdue",
          "stage_stagnation",
          "owner_overloaded",
          "value_decline",
          "probability_mismatch",
          "inactive_customer",
          "high_value_no_contact",
          "missing_owner",
          "contract_expiring",
        ];
        return input.rules!.includes(ruleIds[index]);
      })
    : ALL_RULES;

  const results: DecisionResult[] = [];
  for (const rule of rulesToRun) {
    const result = rule(ctx);
    if (result) results.push(result);
  }

  results.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) return severityOrder[a.severity] - severityOrder[b.severity];
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const summary = {
    total: results.length,
    critical: results.filter((r) => r.severity === "critical").length,
    warning: results.filter((r) => r.severity === "warning").length,
    info: results.filter((r) => r.severity === "info").length,
  };

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    analyzedAt: now(),
    results,
    summary,
  };
}

export function getAllDecisionRuleIds(): DecisionRuleId[] {
  return [
    "follow_up_overdue",
    "task_overdue",
    "stage_stagnation",
    "owner_overloaded",
    "value_decline",
    "probability_mismatch",
    "inactive_customer",
    "high_value_no_contact",
    "missing_owner",
    "contract_expiring",
  ];
}

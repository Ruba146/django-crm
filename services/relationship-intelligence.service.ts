import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  RelationshipContact,
  RelationshipIntelligence,
  RelationshipRole,
  RelationshipSignals,
} from "@/types/relationship-intelligence";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function daysSinceDate(dateStr: string | null): number {
  if (!dateStr) return 9999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ------------------------------------------------------------------ */
/* Role inference                                                      */
/* ------------------------------------------------------------------ */

function inferUserRole(isOwner: boolean, taskCount: number, activityCount: number): RelationshipRole {
  if (isOwner && activityCount > 0) return "owner";
  if (isOwner) return "owner";
  if (taskCount > 2 && activityCount > 2) return "champion";
  if (activityCount > 3) return "influencer";
  if (taskCount > 0) return "stakeholder";
  if (activityCount > 0) return "stakeholder";
  return "unknown";
}

function inferContactRole(
  isPrimary: boolean,
  role: string | null,
  dealCount: number,
  leadCount: number,
  activityCount: number
): RelationshipRole {
  if (isPrimary && dealCount > 0) return "primary_contact";
  if (isPrimary) return "primary_contact";
  if (role) {
    const lower = role.toLowerCase();
    if (["ceo", "owner", "director", "manager", "decision maker", "decision_maker"].some((r) => lower.includes(r))) {
      return "decision_maker";
    }
    if (["assistant", "receptionist", "pa"].some((r) => lower.includes(r))) {
      return "gatekeeper";
    }
    if (["blocker", "opponent", "negative"].some((r) => lower.includes(r))) {
      return "blocker";
    }
    if (["champion", "advocate", "supporter"].some((r) => lower.includes(r))) {
      return "champion";
    }
    if (["influencer", "influence"].some((r) => lower.includes(r))) {
      return "influencer";
    }
  }
  if (dealCount > 0 && activityCount > 2) return "influencer";
  if (dealCount > 0) return "stakeholder";
  if (leadCount > 0) return "stakeholder";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Signal collection                                                   */
/* ------------------------------------------------------------------ */

interface UserSignals {
  userId: string;
  userName: string | null;
  activityCount: number;
  incomingActivityCount: number;
  outgoingActivityCount: number;
  lastActivityAt: string | null;
  recentActivityCount: number;
  taskCount: number;
  completedTaskCount: number;
  dealCount: number;
  wonDealCount: number;
  isOwner: boolean;
  eventCount: number;
}

interface ContactSignals {
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactRole: string | null;
  isPrimary: boolean;
  activityCount: number;
  lastActivityAt: string | null;
  recentActivityCount: number;
  taskCount: number;
  completedTaskCount: number;
  dealCount: number;
  wonDealCount: number;
  leadCount: number;
  eventCount: number;
}

function getUserSignals(db: ReturnType<typeof getDb>, entityType: string, entityId: string): UserSignals[] {
  const signalsMap = new Map<string, UserSignals>();

  const addUser = (userId: string, userName: string | null) => {
    if (!signalsMap.has(userId)) {
      signalsMap.set(userId, {
        userId,
        userName,
        activityCount: 0,
        incomingActivityCount: 0,
        outgoingActivityCount: 0,
        lastActivityAt: null,
        recentActivityCount: 0,
        taskCount: 0,
        completedTaskCount: 0,
        dealCount: 0,
        wonDealCount: 0,
        isOwner: false,
        eventCount: 0,
      });
    }
  };

  if (entityType === "customer") {
    const leads = db
      .prepare(`SELECT id, owner_id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL`)
      .all(entityId) as Array<{ id: string; owner_id: string | null }>;

    for (const lead of leads) {
      if (lead.owner_id) {
        const user = db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(lead.owner_id) as { name: string | null } | undefined;
        addUser(lead.owner_id, user?.name ?? null);
        signalsMap.get(lead.owner_id)!.isOwner = true;
      }
    }

    const dealIds = db
      .prepare(`SELECT id, owner_id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL`)
      .all(entityId) as Array<{ id: string; owner_id: string | null }>;

    for (const deal of dealIds) {
      if (deal.owner_id) {
        const user = db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(deal.owner_id) as { name: string | null } | undefined;
        addUser(deal.owner_id, user?.name ?? null);
        signalsMap.get(deal.owner_id)!.isOwner = true;
      }
    }
  } else if (entityType === "lead") {
    const lead = db.prepare(`SELECT owner_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`).get(entityId) as { owner_id: string | null } | undefined;
    if (lead?.owner_id) {
      const user = db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(lead.owner_id) as { name: string | null } | undefined;
      addUser(lead.owner_id, user?.name ?? null);
      signalsMap.get(lead.owner_id)!.isOwner = true;
    }
  } else if (entityType === "deal") {
    const deal = db.prepare(`SELECT owner_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(entityId) as { owner_id: string | null } | undefined;
    if (deal?.owner_id) {
      const user = db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(deal.owner_id) as { name: string | null } | undefined;
      addUser(deal.owner_id, user?.name ?? null);
      signalsMap.get(deal.owner_id)!.isOwner = true;
    }
  }

  let activityQuery: string;
  let activityParams: unknown[];

  if (entityType === "customer") {
    activityQuery = `SELECT a.user_id, a.direction, a.occurred_at FROM ${TABLES.activities} a WHERE (a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL)) OR (a.entity_type = 'deal' AND a.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))`;
    activityParams = [entityId, entityId];
  } else {
    activityQuery = `SELECT user_id, direction, occurred_at FROM ${TABLES.activities} WHERE entity_type = ? AND entity_id = ?`;
    activityParams = [entityType, entityId];
  }

  const activities = db.prepare(activityQuery).all(...activityParams) as Array<{ user_id: string | null; direction: string | null; occurred_at: string | null }>;
  for (const act of activities) {
    if (!act.user_id) continue;
    addUser(act.user_id, null);
    const sig = signalsMap.get(act.user_id)!;
    sig.activityCount++;
    const dir = (act.direction ?? "").toLowerCase();
    if (dir === "inbound" || dir === "incoming" || dir === "received") {
      sig.incomingActivityCount++;
    } else if (dir === "outbound" || dir === "outgoing" || dir === "sent") {
      sig.outgoingActivityCount++;
    } else {
      sig.incomingActivityCount++;
    }
    if (act.occurred_at) {
      if (!sig.lastActivityAt || act.occurred_at > sig.lastActivityAt) {
        sig.lastActivityAt = act.occurred_at;
      }
      if (daysSinceDate(act.occurred_at) <= 30) {
        sig.recentActivityCount++;
      }
    }
  }

  let taskQuery: string;
  let taskParams: unknown[];

  if (entityType === "customer") {
    taskQuery = `SELECT t.assignee_id, t.completed_at FROM ${TABLES.tasks} t WHERE (t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL)) OR (t.entity_type = 'deal' AND t.entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))`;
    taskParams = [entityId, entityId];
  } else {
    taskQuery = `SELECT assignee_id, completed_at FROM ${TABLES.tasks} WHERE entity_type = ? AND entity_id = ?`;
    taskParams = [entityType, entityId];
  }

  const tasks = db.prepare(taskQuery).all(...taskParams) as Array<{ assignee_id: string | null; completed_at: string | null }>;
  for (const task of tasks) {
    if (!task.assignee_id) continue;
    addUser(task.assignee_id, null);
    const sig = signalsMap.get(task.assignee_id)!;
    sig.taskCount++;
    if (task.completed_at) sig.completedTaskCount++;
  }

  let dealIds: string[] = [];
  if (entityType === "customer") {
    dealIds = db.prepare(`SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL`).all(entityId).map((r: unknown) => (r as { id: string }).id);
  } else if (entityType === "lead") {
    dealIds = db.prepare(`SELECT id FROM ${TABLES.deals} WHERE lead_id = ? AND deleted_at IS NULL`).all(entityId).map((r: unknown) => (r as { id: string }).id);
  } else if (entityType === "deal") {
    dealIds = [entityId];
  }

  if (dealIds.length > 0) {
    const placeholders = dealIds.map(() => "?").join(",");
    const deals = db.prepare(`SELECT owner_id, stage_id FROM ${TABLES.deals} WHERE id IN (${placeholders})`).all(...dealIds) as Array<{ owner_id: string | null; stage_id: string | null }>;
    for (const deal of deals) {
      if (deal.owner_id && signalsMap.has(deal.owner_id)) {
        signalsMap.get(deal.owner_id)!.dealCount++;
        const stage = db.prepare(`SELECT terminal_type FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(deal.stage_id) as { terminal_type: string | null } | undefined;
        if (stage?.terminal_type === "won") {
          signalsMap.get(deal.owner_id)!.wonDealCount++;
        }
      }
    }
  }

  const eventQuery = entityType === "customer"
    ? `SELECT actor_id FROM ${TABLES.events} WHERE (entity_type = 'lead' AND entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL)) OR (entity_type = 'deal' AND entity_id IN (SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL))`
    : `SELECT actor_id FROM ${TABLES.events} WHERE entity_type = ? AND entity_id = ?`;

  const eventParams = entityType === "customer" ? [entityId, entityId] : [entityType, entityId];
  const events = db.prepare(eventQuery).all(...eventParams) as Array<{ actor_id: string | null }>;
  for (const evt of events) {
    if (!evt.actor_id) continue;
    if (signalsMap.has(evt.actor_id)) {
      signalsMap.get(evt.actor_id)!.eventCount++;
    }
  }

  return Array.from(signalsMap.values());
}

function getContactSignals(db: ReturnType<typeof getDb>, entityType: string, entityId: string): ContactSignals[] {
  const signalsMap = new Map<string, ContactSignals>();

  let establishmentId: string | null = null;

  if (entityType === "customer") {
    establishmentId = entityId;
  } else if (entityType === "lead") {
    const lead = db.prepare(`SELECT establishment_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`).get(entityId) as { establishment_id: string | null } | undefined;
    establishmentId = lead?.establishment_id ?? null;
  } else if (entityType === "deal") {
    const deal = db.prepare(`SELECT establishment_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(entityId) as { establishment_id: string | null } | undefined;
    establishmentId = deal?.establishment_id ?? null;
  }

  if (!establishmentId) return [];

  const contacts = db
    .prepare(`SELECT id, full_name, email, phone, role, created_at FROM ${TABLES.contacts} WHERE establishment_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`)
    .all(establishmentId) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; role: string | null; created_at: string | null }>;

  const primaryContactId = contacts.length > 0 ? contacts[0].id : null;

  for (const contact of contacts) {
    signalsMap.set(contact.id, {
      contactId: contact.id,
      contactName: contact.full_name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      contactRole: contact.role,
      isPrimary: contact.id === primaryContactId,
      activityCount: 0,
      lastActivityAt: null,
      recentActivityCount: 0,
      taskCount: 0,
      completedTaskCount: 0,
      dealCount: 0,
      wonDealCount: 0,
      leadCount: 0,
      eventCount: 0,
    });
  }

  const leads = db
    .prepare(`SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL`)
    .all(establishmentId) as Array<{ id: string }>;

  const deals = db
    .prepare(`SELECT id, stage_id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL`)
    .all(establishmentId) as Array<{ id: string; stage_id: string | null }>;

  const leadIds = leads.map((l) => l.id);
  const dealIds = deals.map((d) => d.id);

  if (leadIds.length > 0) {
    const placeholders = leadIds.map(() => "?").join(",");
    const leadActivities = db.prepare(`SELECT occurred_at FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id IN (${placeholders})`).all(...leadIds) as Array<{ occurred_at: string | null }>;
    for (const act of leadActivities) {
      if (!act.occurred_at) continue;
      for (const sig of signalsMap.values()) {
        sig.activityCount++;
        if (daysSinceDate(act.occurred_at) <= 30) sig.recentActivityCount++;
        if (!sig.lastActivityAt || act.occurred_at > sig.lastActivityAt) {
          sig.lastActivityAt = act.occurred_at;
        }
      }
    }

    const leadTasks = db.prepare(`SELECT completed_at FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id IN (${placeholders})`).all(...leadIds) as Array<{ completed_at: string | null }>;
    for (const task of leadTasks) {
      for (const sig of signalsMap.values()) {
        sig.taskCount++;
        if (task.completed_at) sig.completedTaskCount++;
      }
    }

    const leadEvents = db.prepare(`SELECT timestamp FROM ${TABLES.events} WHERE entity_type = 'lead' AND entity_id IN (${placeholders})`).all(...leadIds) as Array<{ timestamp: string }>;
    for (const evt of leadEvents) {
      for (const sig of signalsMap.values()) {
        sig.eventCount++;
      }
    }
  }

  if (dealIds.length > 0) {
    const placeholders = dealIds.map(() => "?").join(",");
    const dealActivities = db.prepare(`SELECT occurred_at FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id IN (${placeholders})`).all(...dealIds) as Array<{ occurred_at: string | null }>;
    for (const act of dealActivities) {
      if (!act.occurred_at) continue;
      for (const sig of signalsMap.values()) {
        sig.activityCount++;
        if (daysSinceDate(act.occurred_at) <= 30) sig.recentActivityCount++;
        if (!sig.lastActivityAt || act.occurred_at > sig.lastActivityAt) {
          sig.lastActivityAt = act.occurred_at;
        }
      }
    }

    const dealTasks = db.prepare(`SELECT completed_at FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id IN (${placeholders})`).all(...dealIds) as Array<{ completed_at: string | null }>;
    for (const task of dealTasks) {
      for (const sig of signalsMap.values()) {
        sig.taskCount++;
        if (task.completed_at) sig.completedTaskCount++;
      }
    }

    const dealEvents = db.prepare(`SELECT timestamp FROM ${TABLES.events} WHERE entity_type = 'deal' AND entity_id IN (${placeholders})`).all(...dealIds) as Array<{ timestamp: string }>;
    for (const evt of dealEvents) {
      for (const sig of signalsMap.values()) {
        sig.eventCount++;
      }
    }

    for (const deal of deals) {
      const stage = db.prepare(`SELECT terminal_type FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(deal.stage_id) as { terminal_type: string | null } | undefined;
      for (const sig of signalsMap.values()) {
        sig.dealCount++;
        if (stage?.terminal_type === "won") sig.wonDealCount++;
      }
    }
  }

  for (const sig of signalsMap.values()) {
    sig.leadCount = leadIds.length;
  }

  return Array.from(signalsMap.values());
}

/* ------------------------------------------------------------------ */
/* Strength calculation                                                */
/* ------------------------------------------------------------------ */

function calculateUserStrength(signals: UserSignals): number {
  let score = 0;

  if (signals.isOwner) score += 25;
  score += clamp(signals.activityCount * 2, 0, 20);
  score += clamp(signals.completedTaskCount * 3, 0, 15);

  if (signals.lastActivityAt) {
    const days = daysSinceDate(signals.lastActivityAt);
    if (days <= 7) score += 15;
    else if (days <= 30) score += 10;
    else if (days <= 90) score += 5;
  }

  score += clamp(signals.eventCount * 2, 0, 10);
  score += clamp(signals.incomingActivityCount * 3, 0, 10);
  score += clamp(signals.taskCount * 1, 0, 5);

  if (signals.wonDealCount > 0) score += 10;
  if (signals.dealCount > 0) score += 5;

  return clamp(score, 0, 100);
}

function calculateContactStrength(signals: ContactSignals): number {
  let score = 0;

  if (signals.isPrimary) score += 20;
  if (signals.contactRole) score += 5;

  score += clamp(signals.dealCount * 4, 0, 20);
  score += clamp(signals.leadCount * 2, 0, 10);
  score += clamp(signals.activityCount * 1.5, 0, 20);

  if (signals.lastActivityAt) {
    const days = daysSinceDate(signals.lastActivityAt);
    if (days <= 7) score += 10;
    else if (days <= 30) score += 7;
    else if (days <= 90) score += 3;
  }

  score += clamp(signals.completedTaskCount * 2, 0, 10);
  if (signals.wonDealCount > 0) score += 5;
  score += clamp(signals.eventCount * 1, 0, 5);

  return clamp(score, 0, 100);
}

function buildSignals(signals: UserSignals): RelationshipSignals {
  return {
    activityCount: signals.activityCount,
    lastActivityAt: signals.lastActivityAt,
    recentActivityCount: signals.recentActivityCount,
    taskCount: signals.taskCount,
    completedTaskCount: signals.completedTaskCount,
    dealCount: signals.dealCount,
    wonDealCount: signals.wonDealCount,
    isOwner: signals.isOwner,
    eventCount: signals.eventCount,
    incomingActivityCount: signals.incomingActivityCount,
    outgoingActivityCount: signals.outgoingActivityCount,
  };
}

function buildContactSignals(signals: ContactSignals): RelationshipSignals {
  return {
    activityCount: signals.activityCount,
    lastActivityAt: signals.lastActivityAt,
    recentActivityCount: signals.recentActivityCount,
    taskCount: signals.taskCount,
    completedTaskCount: signals.completedTaskCount,
    dealCount: signals.dealCount,
    wonDealCount: signals.wonDealCount,
    isOwner: signals.isPrimary,
    eventCount: signals.eventCount,
    incomingActivityCount: 0,
    outgoingActivityCount: 0,
  };
}

function getFactors(role: RelationshipRole, score: number): string[] {
  const factors: string[] = [];

  switch (role) {
    case "owner":
      factors.push("Owns this record");
      break;
    case "primary_contact":
      factors.push("Primary contact at company");
      break;
    case "champion":
      factors.push("High engagement across activities and tasks");
      break;
    case "influencer":
      factors.push("Frequent interactions without direct ownership");
      break;
    case "gatekeeper":
      factors.push("Controls access to decision makers");
      break;
    case "blocker":
      factors.push("Identified as potential blocker");
      break;
    case "decision_maker":
      factors.push("Decision-making authority indicated by role");
      break;
    case "stakeholder":
      factors.push("Involved in multiple related activities");
      break;
    default:
      if (score > 50) factors.push("Some engagement detected");
      else factors.push("Insufficient data");
  }

  if (score >= 80) factors.push("Strong relationship");
  else if (score >= 50) factors.push("Moderate relationship");
  else if (score >= 20) factors.push("Weak relationship");
  else factors.push("Very weak or missing relationship");

  return factors;
}

/* ------------------------------------------------------------------ */
/* Weak points and missing relationships                               */
/* ------------------------------------------------------------------ */

function analyzeWeakPoints(relationships: RelationshipContact[]): string[] {
  const weakPoints: string[] = [];
  const owners = relationships.filter((r) => r.role === "owner");
  const contacts = relationships.filter((r) => r.type === "contact");
  const users = relationships.filter((r) => r.type === "user");

  if (owners.length === 0) weakPoints.push("No owner assigned");
  if (contacts.length === 0) weakPoints.push("No contacts found");
  if (users.length === 0) weakPoints.push("No employee engagement");

  const strongContacts = contacts.filter((c) => c.strength >= 60);
  if (contacts.length > 0 && strongContacts.length === 0) weakPoints.push("All contacts have weak relationships");

  const strongUsers = users.filter((u) => u.strength >= 60);
  if (users.length > 0 && strongUsers.length === 0) weakPoints.push("All employees have weak engagement");

  const stale = relationships.filter((r) => r.signals.lastActivityAt && daysSinceDate(r.signals.lastActivityAt) > 90);
  if (stale.length > 0) weakPoints.push(`${stale.length} relationship(s) with no recent activity`);

  return weakPoints;
}

function analyzeMissingRelationships(relationships: RelationshipContact[], entityType: string): string[] {
  const missing: string[] = [];
  const hasOwner = relationships.some((r) => r.role === "owner");
  const hasChampion = relationships.some((r) => r.role === "champion");
  const hasDecisionMaker = relationships.some((r) => r.role === "decision_maker");
  const hasPrimaryContact = relationships.some((r) => r.role === "primary_contact");

  if (!hasOwner) missing.push("Assign an owner to drive this record");
  if (!hasPrimaryContact && entityType !== "deal") missing.push("Designate a primary contact");
  if (!hasChampion) missing.push("Identify an internal champion");
  if (!hasDecisionMaker) missing.push("Map the decision maker");
  if (relationships.length === 0) missing.push("No relationships mapped yet");

  return missing;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export function getRelationshipIntelligence(
  entityType: "customer" | "lead" | "deal",
  entityId: string
): RelationshipIntelligence | null {
  const db = getDb();

  let entityName: string | null = null;
  if (entityType === "customer") {
    const row = db.prepare(`SELECT name FROM ${TABLES.customers} WHERE id = ? LIMIT 1`).get(entityId) as { name: string | null } | undefined;
    entityName = row?.name ?? null;
  } else if (entityType === "lead") {
    const row = db.prepare(`SELECT full_name FROM ${TABLES.leads} WHERE id = ? LIMIT 1`).get(entityId) as { full_name: string | null } | undefined;
    entityName = row?.full_name ?? null;
  } else if (entityType === "deal") {
    const row = db.prepare(`SELECT name FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(entityId) as { name: string | null } | undefined;
    entityName = row?.name ?? null;
  }

  if (!entityName) return null;

  const userSignals = getUserSignals(db, entityType, entityId);
  const contactSignals = getContactSignals(db, entityType, entityId);

  const relationships: RelationshipContact[] = [];

  for (const sig of userSignals) {
    const strength = calculateUserStrength(sig);
    const role = inferUserRole(sig.isOwner, sig.taskCount, sig.activityCount);
    relationships.push({
      id: sig.userId,
      type: "user",
      name: sig.userName,
      email: null,
      phone: null,
      role,
      strength,
      factors: getFactors(role, strength),
      signals: buildSignals(sig),
    });
  }

  for (const sig of contactSignals) {
    const strength = calculateContactStrength(sig);
    const role = inferContactRole(sig.isPrimary, sig.contactRole, sig.dealCount, sig.leadCount, sig.activityCount);
    relationships.push({
      id: sig.contactId,
      type: "contact",
      name: sig.contactName,
      email: sig.contactEmail,
      phone: sig.contactPhone,
      role,
      strength,
      factors: getFactors(role, strength),
      signals: buildContactSignals(sig),
    });
  }

  relationships.sort((a, b) => b.strength - a.strength);

  const overallStrength = relationships.length > 0
    ? Math.round(relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length)
    : 0;

  const weakPoints = analyzeWeakPoints(relationships);
  const missingRelationships = analyzeMissingRelationships(relationships, entityType);

  return {
    entityType,
    entityId,
    entityName,
    overallStrength,
    relationships,
    weakPoints,
    missingRelationships,
  };
}

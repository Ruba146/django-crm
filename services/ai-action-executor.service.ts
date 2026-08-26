import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type { AIAction } from "@/types/ai-chat";
import { recordEvent } from "@/services/event.service";

export interface ActionResult {
  success: boolean;
  id?: string;
  message: string;
  details?: Record<string, unknown>;
}

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function getCurrentUserId(): string | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT id FROM ${TABLES.users} WHERE is_active IS NULL OR is_active = 1 LIMIT 1`)
    .get() as { id: string } | undefined;
  return row?.id;
}

function validateRequired(params: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = params[field];
    if (value === undefined || value === null || value === "") {
      return `${field} is required`;
    }
  }
  return null;
}

export function executeAction(action: AIAction): ActionResult {
  switch (action.type) {
    case "create_task":
      return createTask(action.params);
    case "create_activity":
      return createActivity(action.params);
    case "create_lead":
      return createLead(action.params);
    case "create_deal":
      return createDeal(action.params);
    case "create_note":
      return createNote(action.params);
    case "update_deal_stage":
      return updateDealStage(action.params);
    case "assign_owner":
      return assignOwner(action.params);
    case "schedule_followup":
      return scheduleFollowup(action.params);
    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

function createTask(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["title"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const entityType = (params.entity_type as string) || null;
  const entityId = (params.entity_id as string) || null;
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (entityType && entityId) {
    const validTables: Record<string, string> = {
      customer: TABLES.customers,
      lead: TABLES.leads,
      deal: TABLES.deals,
      activity: TABLES.activities,
      task: TABLES.tasks,
    };
    const table = validTables[entityType];
    if (table) {
      const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).get(entityId) as { id: string } | undefined;
      if (!existing) {
        return { success: false, message: `${entityType} not found: ${entityId}` };
      }
    }
  }

  const id = generateId();
  const timestamp = now();
  const title = params.title as string;
  const description = (params.description as string) || null;
  const mode = (params.mode as string) || "task";
  const assigneeId = (params.assignee_id as string) || null;
  const dueAt = (params.due_at as string) || null;

  db.prepare(`
    INSERT INTO ${TABLES.tasks} (id, entity_type, entity_id, title, description, mode, assignee_id, due_at, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, title, description, mode, assigneeId, dueAt, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "TASK_CREATED",
    entity_type: "task",
    entity_id: id,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    new_state: { title, mode, assignee_id: assigneeId, due_at: dueAt, entity_type: entityType, entity_id: entityId },
  });

  return {
    success: true,
    id,
    message: `Task "${title}" created successfully`,
    details: { id, title, entity_type: entityType, entity_id: entityId, due_at: dueAt },
  };
}

function createActivity(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["body"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const entityType = (params.entity_type as string) || null;
  const entityId = (params.entity_id as string) || null;
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (entityType && entityId) {
    const validTables: Record<string, string> = {
      customer: TABLES.customers,
      lead: TABLES.leads,
      deal: TABLES.deals,
      activity: TABLES.activities,
      task: TABLES.tasks,
    };
    const table = validTables[entityType];
    if (table) {
      const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).get(entityId) as { id: string } | undefined;
      if (!existing) {
        return { success: false, message: `${entityType} not found: ${entityId}` };
      }
    }
  }

  const id = generateId();
  const timestamp = now();
  const body = params.body as string;
  const direction = (params.direction as string) || "outbound";
  const activityTypeId = (params.activity_type_id as string) || null;
  const userId = getCurrentUserId();
  const occurredAt = (params.occurred_at as string) || timestamp;

  db.prepare(`
    INSERT INTO ${TABLES.activities} (id, entity_type, entity_id, activity_type_id, direction, body, user_id, occurred_at, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, activityTypeId, direction, body, userId, occurredAt, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "ACTIVITY_CREATED",
    entity_type: "activity",
    entity_id: id,
    actor_id: userId ?? undefined,
    source: "ai_action",
    new_state: { body, direction, entity_type: entityType, entity_id: entityId },
  });

  return {
    success: true,
    id,
    message: `Activity logged successfully`,
    details: { id, body, entity_type: entityType, entity_id: entityId },
  };
}

function createNote(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["body"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const entityType = (params.entity_type as string) || null;
  const entityId = (params.entity_id as string) || null;
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (entityType && entityId) {
    const validTables: Record<string, string> = {
      customer: TABLES.customers,
      lead: TABLES.leads,
      deal: TABLES.deals,
      activity: TABLES.activities,
      task: TABLES.tasks,
    };
    const table = validTables[entityType];
    if (table) {
      const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).get(entityId) as { id: string } | undefined;
      if (!existing) {
        return { success: false, message: `${entityType} not found: ${entityId}` };
      }
    }
  }

  const id = generateId();
  const timestamp = now();
  const body = params.body as string;
  const authorId = getCurrentUserId();

  db.prepare(`
    INSERT INTO ${TABLES.notes} (id, entity_type, entity_id, body, author_id, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, body, authorId, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "NOTE_CREATED",
    entity_type: "note",
    entity_id: id,
    actor_id: authorId ?? undefined,
    source: "ai_action",
    new_state: { body, entity_type: entityType, entity_id: entityId },
  });

  return {
    success: true,
    id,
    message: `Note created successfully`,
    details: { id, body, entity_type: entityType, entity_id: entityId },
  };
}

function createLead(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["full_name"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const id = generateId();
  const timestamp = now();
  const fullName = params.full_name as string;
  const phone = (params.phone as string) || null;
  const email = (params.email as string) || null;
  const company = (params.company as string) || null;
  const sourceId = (params.source_id as string) || null;
  const stageId = (params.stage_id as string) || null;
  const ownerId = (params.owner_id as string) || getCurrentUserId();
  const notes = (params.notes as string) || null;
  const establishmentId = (params.establishment_id as string) || null;
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (sourceId) {
    const source = db.prepare(`SELECT id FROM ${TABLES.sources} WHERE id = ? LIMIT 1`).get(sourceId) as { id: string } | undefined;
    if (!source) return { success: false, message: `Source not found: ${sourceId}` };
  }

  if (stageId) {
    const stage = db.prepare(`SELECT id FROM ${TABLES.stages} WHERE id = ? AND pipeline = 'lead' LIMIT 1`).get(stageId) as { id: string } | undefined;
    if (!stage) return { success: false, message: `Lead stage not found: ${stageId}` };
  }

  if (establishmentId) {
    const establishment = db.prepare(`SELECT id FROM ${TABLES.customers} WHERE id = ? LIMIT 1`).get(establishmentId) as { id: string } | undefined;
    if (!establishment) return { success: false, message: `Company not found: ${establishmentId}` };
  }

  if (ownerId) {
    const owner = db.prepare(`SELECT id FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(ownerId) as { id: string } | undefined;
    if (!owner) return { success: false, message: `Owner not found: ${ownerId}` };
  }

  db.prepare(`
    INSERT INTO ${TABLES.leads} (id, full_name, normalized_phone, normalized_email, establishment_id, stage_id, primary_source_id, owner_id, notes, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, fullName, phone, email, establishmentId, stageId, sourceId, ownerId, notes, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "LEAD_CREATED",
    entity_type: "lead",
    entity_id: id,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    new_state: { full_name: fullName, establishment_id: establishmentId, stage_id: stageId, owner_id: ownerId },
  });

  return {
    success: true,
    id,
    message: `Lead "${fullName}" created successfully`,
    details: { id, full_name: fullName, company, phone, email },
  };
}

function createDeal(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["name"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const id = generateId();
  const timestamp = now();
  const name = params.name as string;
  const leadId = (params.lead_id as string) || null;
  const establishmentId = (params.establishment_id as string) || null;
  const stageId = (params.stage_id as string) || null;
  const ownerId = (params.owner_id as string) || getCurrentUserId();
  const expectedValueMinor = params.expected_value_minor !== undefined ? Number(params.expected_value_minor) : null;
  const probabilityPct = params.probability_pct !== undefined ? Number(params.probability_pct) : null;
  const targetCloseDate = (params.target_close_date as string) || null;
  const notes = (params.notes as string) || null;
  const currencyCode = (params.currency_code as string) || "SAR";
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (leadId) {
    const lead = db.prepare(`SELECT id FROM ${TABLES.leads} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(leadId) as { id: string } | undefined;
    if (!lead) return { success: false, message: `Lead not found: ${leadId}` };
  }

  if (establishmentId) {
    const establishment = db.prepare(`SELECT id FROM ${TABLES.customers} WHERE id = ? LIMIT 1`).get(establishmentId) as { id: string } | undefined;
    if (!establishment) return { success: false, message: `Company not found: ${establishmentId}` };
  }

  if (stageId) {
    const stage = db.prepare(`SELECT id FROM ${TABLES.stages} WHERE id = ? AND pipeline = 'deal' LIMIT 1`).get(stageId) as { id: string } | undefined;
    if (!stage) return { success: false, message: `Deal stage not found: ${stageId}` };
  }

  if (ownerId) {
    const owner = db.prepare(`SELECT id FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(ownerId) as { id: string } | undefined;
    if (!owner) return { success: false, message: `Owner not found: ${ownerId}` };
  }

  db.prepare(`
    INSERT INTO ${TABLES.deals} (id, lead_id, establishment_id, stage_id, owner_id, name, expected_value_minor, probability_pct, target_close_date, currency_code, notes, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, leadId, establishmentId, stageId, ownerId, name, expectedValueMinor, probabilityPct, targetCloseDate, currencyCode, notes, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "DEAL_CREATED",
    entity_type: "deal",
    entity_id: id,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    new_state: { name, lead_id: leadId, establishment_id: establishmentId, stage_id: stageId, owner_id: ownerId, expected_value_minor: expectedValueMinor },
  });

  return {
    success: true,
    id,
    message: `Deal "${name}" created successfully`,
    details: { id, name, stage_id: stageId, expected_value_minor: expectedValueMinor },
  };
}

function updateDealStage(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["deal_id", "stage_id"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const dealId = params.deal_id as string;
  const stageId = params.stage_id as string;
  const timestamp = now();

  const existing = db
    .prepare(`SELECT id, name, stage_id FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
    .get(dealId) as { id: string; name: string; stage_id: string | null } | undefined;

  if (!existing) {
    return { success: false, message: `Deal not found: ${dealId}` };
  }

  const stage = db
    .prepare(`SELECT id FROM ${TABLES.stages} WHERE id = ? AND pipeline = 'deal' LIMIT 1`)
    .get(stageId) as { id: string } | undefined;

  if (!stage) {
    return { success: false, message: `Deal stage not found: ${stageId}` };
  }

  const previousStageId = existing.stage_id;
  db.prepare(`UPDATE ${TABLES.deals} SET stage_id = ?, updated_at = ? WHERE id = ?`)
    .run(stageId, timestamp, dealId);

  recordEvent({
    event_type: "STAGE_CHANGED",
    entity_type: "deal",
    entity_id: dealId,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    previous_state: { stage_id: previousStageId },
    new_state: { stage_id: stageId },
  });

  return {
    success: true,
    id: dealId,
    message: `Deal "${existing.name}" stage updated successfully`,
    details: { deal_id: dealId, stage_id: stageId },
  };
}

function assignOwner(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["entity_type", "entity_id", "owner_id"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const entityType = params.entity_type as string;
  const entityId = params.entity_id as string;
  const ownerId = params.owner_id as string;
  const timestamp = now();

  const validTables: Record<string, string> = {
    customer: TABLES.customers,
    lead: TABLES.leads,
    deal: TABLES.deals,
    activity: TABLES.activities,
    task: TABLES.tasks,
  };

  const table = validTables[entityType];
  if (!table) {
    return { success: false, message: `Cannot assign owner to entity type: ${entityType}` };
  }

  const existing = db
    .prepare(`SELECT id, owner_id FROM ${table} WHERE id = ? LIMIT 1`)
    .get(entityId) as { id: string; owner_id: string | null } | undefined;

  if (!existing) {
    return { success: false, message: `${entityType} not found: ${entityId}` };
  }

  const previousOwnerId = existing.owner_id;

  const owner = db
    .prepare(`SELECT id, name FROM ${TABLES.users} WHERE id = ? LIMIT 1`)
    .get(ownerId) as { id: string; name: string } | undefined;

  if (!owner) {
    return { success: false, message: `Owner not found: ${ownerId}` };
  }

  db.prepare(`UPDATE ${table} SET owner_id = ?, updated_at = ? WHERE id = ?`)
    .run(ownerId, timestamp, entityId);

  recordEvent({
    event_type: "OWNER_CHANGED",
    entity_type: entityType as "customer" | "lead" | "deal" | "task" | "activity",
    entity_id: entityId,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    previous_state: { owner_id: previousOwnerId },
    new_state: { owner_id: ownerId },
  });

  return {
    success: true,
    id: entityId,
    message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} assigned to ${owner.name || ownerId}`,
    details: { entity_type: entityType, entity_id: entityId, owner_id: ownerId },
  };
}

function scheduleFollowup(params: Record<string, unknown>): ActionResult {
  const missing = validateRequired(params, ["title", "due_at"]);
  if (missing) return { success: false, message: missing };

  const db = getDb();
  const entityType = (params.entity_type as string) || null;
  const entityId = (params.entity_id as string) || null;
  const isAiCopy = params.is_ai_copy === true || params.is_ai_copy === 1 || params.is_ai_copy === "1" ? 1 : 0;
  const aiSource = (params.ai_source as string) || null;
  const sourceRecordId = (params.source_record_id as string) || null;
  const aiActionId = (params.ai_action_id as string) || null;

  if (entityType && entityId) {
    const validTables: Record<string, string> = {
      customer: TABLES.customers,
      lead: TABLES.leads,
      deal: TABLES.deals,
      activity: TABLES.activities,
      task: TABLES.tasks,
    };
    const table = validTables[entityType];
    if (table) {
      const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).get(entityId) as { id: string } | undefined;
      if (!existing) {
        return { success: false, message: `${entityType} not found: ${entityId}` };
      }
    }
  }

  const id = generateId();
  const timestamp = now();
  const title = params.title as string;
  const dueAt = params.due_at as string;
  const description = (params.description as string) || "Follow-up";
  const assigneeId = (params.assignee_id as string) || getCurrentUserId();
  const mode = "follow_up";

  if (assigneeId) {
    const assignee = db.prepare(`SELECT id FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(assigneeId) as { id: string } | undefined;
    if (!assignee) return { success: false, message: `Assignee not found: ${assigneeId}` };
  }

  db.prepare(`
    INSERT INTO ${TABLES.tasks} (id, entity_type, entity_id, title, description, mode, assignee_id, due_at, created_at, updated_at, is_ai_copy, ai_source, source_record_id, ai_created_at, ai_action_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, title, description, mode, assigneeId, dueAt, timestamp, timestamp, isAiCopy, aiSource, sourceRecordId, timestamp, aiActionId);

  recordEvent({
    event_type: "TASK_CREATED",
    entity_type: "task",
    entity_id: id,
    actor_id: getCurrentUserId() ?? undefined,
    source: "ai_action",
    new_state: { title, mode, assignee_id: assigneeId, due_at: dueAt, entity_type: entityType, entity_id: entityId },
  });

  return {
    success: true,
    id,
    message: `Follow-up "${title}" scheduled successfully`,
    details: { id, title, due_at: dueAt, entity_type: entityType, entity_id: entityId },
  };
}

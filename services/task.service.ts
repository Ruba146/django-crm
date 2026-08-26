import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  TaskDetail,
  TaskFilterOptions,
  TaskListItem,
  TaskRelatedRecord,
} from "@/types";

/**
 * Task service — reads live data from the existing SQLite CRM database.
 *
 * Tasks are stored in the `tasks` table with `entity_type` + `entity_id`
 * pointing at a lead, deal or establishment. The service resolves the
 * related record's display name and company on demand.
 *
 * Every SQL query stays here. No React component ever touches the database.
 * Functions are synchronous (better-sqlite3) and single-responsibility.
 */

/* ------------------------------------------------------------------ */
/* Paginated list view                                                 */
/* ------------------------------------------------------------------ */

interface TaskPageRow {
  id: string;
  title: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  related_record_name: string | null;
  company_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  task_type_id: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  mode: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
  status: "open" | "completed" | null;
  is_ai_copy: number | null;
}

export interface TaskPageResult {
  records: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getTasksPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  assigneeId?: string;
  taskTypeId?: string;
  entityType?: string;
  dueFrom?: string;
  dueTo?: string;
}): TaskPageResult {
  const db = getDb();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const offset = (page - 1) * pageSize;
  const term = params.search?.trim() ? `%${params.search.trim()}%` : null;

  const where = [];
  const queryParams: unknown[] = [];

  if (term) {
    where.push(
      `(t.title LIKE ? OR COALESCE(t.description, '') LIKE ? OR COALESCE(t.entity_id, '') LIKE ?)`
    );
    queryParams.push(term, term, term);
  }
  if (params.assigneeId) {
    where.push("t.assignee_id = ?");
    queryParams.push(params.assigneeId);
  }
  if (params.taskTypeId) {
    where.push("t.task_type_id = ?");
    queryParams.push(params.taskTypeId);
  }
  if (params.entityType) {
    where.push("t.entity_type = ?");
    queryParams.push(params.entityType);
  }
  if (params.dueFrom) {
    where.push("t.due_at >= ?");
    queryParams.push(params.dueFrom + "T00:00:00");
  }
  if (params.dueTo) {
    where.push("t.due_at <= ?");
    queryParams.push(params.dueTo + "T23:59:59");
  }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  const countRow = db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) as cnt FROM ${TABLES.tasks} t ${whereSql}`
    )
    .get(...queryParams) as { cnt: number };

  const rows = db
    .prepare(
      `WITH deduped_tasks AS (
        SELECT id, MAX(title) AS title, MAX(description) AS description,
               MAX(entity_type) AS entity_type, MAX(entity_id) AS entity_id,
               MAX(assignee_id) AS assignee_id, MAX(task_type_id) AS task_type_id,
               MAX(mode) AS mode, MAX(due_at) AS due_at, MAX(completed_at) AS completed_at,
               MAX(outcome) AS outcome, MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy
        FROM ${TABLES.tasks}
        GROUP BY id
      )
      SELECT
        dt.id,
        dt.title,
        dt.description,
        dt.entity_type,
        dt.entity_id,
        COALESCE(
          (CASE
            WHEN dt.entity_type = 'lead' THEN (SELECT full_name FROM ${TABLES.leads} WHERE id = dt.entity_id)
            WHEN dt.entity_type = 'deal' THEN (SELECT name FROM ${TABLES.deals} WHERE id = dt.entity_id)
            WHEN dt.entity_type = 'establishment' THEN (SELECT name FROM ${TABLES.customers} WHERE id = dt.entity_id)
            ELSE NULL
          END),
          dt.entity_id
        ) AS related_record_name,
        COALESCE(
          (CASE
            WHEN dt.entity_type = 'lead' THEN (SELECT e.name FROM ${TABLES.leads} l LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id WHERE l.id = dt.entity_id)
            WHEN dt.entity_type = 'deal' THEN (SELECT e.name FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id WHERE d.id = dt.entity_id)
            WHEN dt.entity_type = 'establishment' THEN (SELECT name FROM ${TABLES.customers} WHERE id = dt.entity_id)
            ELSE NULL
          END),
          NULL
        ) AS company_name,
        dt.assignee_id,
        COALESCE((SELECT name FROM ${TABLES.users} WHERE id = dt.assignee_id), '') AS assignee_name,
        dt.task_type_id,
        COALESCE((SELECT label FROM ${TABLES.task_types} WHERE id = dt.task_type_id), '') AS task_type_label,
        COALESCE((SELECT color FROM ${TABLES.task_types} WHERE id = dt.task_type_id), '') AS task_type_color,
        dt.mode,
        dt.due_at,
        dt.completed_at,
        dt.outcome,
        dt.created_at,
        dt.is_ai_copy,
        (CASE WHEN dt.completed_at IS NOT NULL THEN 'completed' ELSE 'open' END) AS status
      FROM deduped_tasks dt
      ${whereSql.replace(/t\./g, "dt.")}
      ORDER BY dt.created_at DESC, dt.id ASC
      LIMIT ? OFFSET ?`
    )
    .all(...queryParams, pageSize, offset) as TaskPageRow[];

  const total = Number(countRow?.cnt ?? 0);
  return {
    records: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      relatedRecordName: r.related_record_name,
      companyName: r.company_name,
      assignee_id: r.assignee_id,
      assigneeName: r.assignee_name,
      task_type_id: r.task_type_id,
      taskTypeLabel: r.task_type_label,
      taskTypeColor: r.task_type_color,
      mode: r.mode,
      due_at: r.due_at,
      completed_at: r.completed_at,
      outcome: r.outcome,
      created_at: r.created_at,
      status: r.status as "open" | "completed" | null,
      isAiCopy: r.is_ai_copy === 1,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ------------------------------------------------------------------ */
/* List view (legacy - kept for backward compatibility)               */
/* ------------------------------------------------------------------ */

interface TaskRow {
  id: string;
  title: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  related_record_name: string | null;
  company_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  task_type_id: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  mode: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
  status: "open" | "completed" | null;
  is_ai_copy: number | null;
}

/** All tasks with enriched related-record and assignee info. */
export function getTasks(): TaskListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         t.id,
         t.title,
         t.description,
         t.entity_type,
         t.entity_id,
         COALESCE(
           (CASE
             WHEN t.entity_type = 'lead' THEN (SELECT full_name FROM ${TABLES.leads} WHERE id = t.entity_id)
             WHEN t.entity_type = 'deal' THEN (SELECT name FROM ${TABLES.deals} WHERE id = t.entity_id)
             WHEN t.entity_type = 'establishment' THEN (SELECT name FROM ${TABLES.customers} WHERE id = t.entity_id)
             ELSE NULL
           END),
           t.entity_id
         ) AS related_record_name,
         COALESCE(
           (CASE
             WHEN t.entity_type = 'lead' THEN (SELECT e.name FROM ${TABLES.leads} l LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id WHERE l.id = t.entity_id)
             WHEN t.entity_type = 'deal' THEN (SELECT e.name FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id WHERE d.id = t.entity_id)
             WHEN t.entity_type = 'establishment' THEN (SELECT name FROM ${TABLES.customers} WHERE id = t.entity_id)
             ELSE NULL
           END),
           NULL
         ) AS company_name,
         t.assignee_id,
         COALESCE((SELECT name FROM ${TABLES.users} WHERE id = t.assignee_id), '') AS assignee_name,
         t.task_type_id,
         COALESCE((SELECT label FROM ${TABLES.task_types} WHERE id = t.task_type_id), '') AS task_type_label,
         COALESCE((SELECT color FROM ${TABLES.task_types} WHERE id = t.task_type_id), '') AS task_type_color,
         t.mode,
         t.due_at,
         t.completed_at,
         t.outcome,
         t.created_at,
         t.is_ai_copy,
         (CASE WHEN t.completed_at IS NOT NULL THEN 'completed' ELSE 'open' END) AS status
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       ORDER BY t.created_at DESC`
    )
    .all() as TaskRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    relatedRecordName: r.related_record_name,
    companyName: r.company_name,
    assignee_id: r.assignee_id,
    assigneeName: r.assignee_name,
    task_type_id: r.task_type_id,
    taskTypeLabel: r.task_type_label,
    taskTypeColor: r.task_type_color,
    mode: r.mode,
    due_at: r.due_at,
    completed_at: r.completed_at,
    outcome: r.outcome,
    created_at: r.created_at,
    status: r.status as "open" | "completed" | null,
    isAiCopy: r.is_ai_copy === 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Task detail                                                        */
/* ------------------------------------------------------------------ */

/** Resolve a task's related record summary. */
function resolveRelatedRecord(
  db: ReturnType<typeof getDb>,
  entityType: string | null,
  entityId: string | null
): TaskRelatedRecord | null {
  if (!entityType || !entityId) return null;

  if (entityType === "lead") {
    const row = db
      .prepare(
        `SELECT l.id, l.full_name AS name, e.name AS company_name,
                ps.label AS stage_label, ps.color AS stage_color, u.name AS owner_name
         FROM ${TABLES.leads} l
         LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
         WHERE l.id = ? LIMIT 1`
      )
      .get(entityId) as
        | { id: string; name: string | null; company_name: string | null; stage_label: string | null; stage_color: string | null; owner_name: string | null }
        | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      companyName: row.company_name,
      entity_type: "lead",
      stageLabel: row.stage_label,
      stageColor: row.stage_color,
      ownerName: row.owner_name,
    };
  }

  if (entityType === "deal") {
    const row = db
      .prepare(
        `SELECT d.id, d.name, e.name AS company_name,
                ps.label AS stage_label, ps.color AS stage_color, u.name AS owner_name
         FROM ${TABLES.deals} d
         LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
         WHERE d.id = ? LIMIT 1`
      )
      .get(entityId) as
        | { id: string; name: string | null; company_name: string | null; stage_label: string | null; stage_color: string | null; owner_name: string | null }
        | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      companyName: row.company_name,
      entity_type: "deal",
      stageLabel: row.stage_label,
      stageColor: row.stage_color,
      ownerName: row.owner_name,
    };
  }

  if (entityType === "establishment") {
    const row = db
      .prepare(
        `SELECT e.id, e.name, NULL AS stage_label, NULL AS stage_color, NULL AS owner_name
         FROM ${TABLES.customers} e WHERE e.id = ? LIMIT 1`
      )
      .get(entityId) as
        | { id: string; name: string | null; stage_label: string | null; stage_color: string | null; owner_name: string | null }
        | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      companyName: row.name,
      entity_type: "establishment",
      stageLabel: null,
      stageColor: null,
      ownerName: null,
    };
  }

  return null;
}

/** Full task detail for the modal. */
export function getTaskDetail(id: string): TaskDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         t.id, t.title, t.description, t.entity_type, t.entity_id,
         t.task_type_id, t.mode, t.assignee_id, t.due_at, t.completed_at,
         t.outcome, t.created_at, t.updated_at, t.is_ai_copy,
         (CASE WHEN t.completed_at IS NOT NULL THEN 'completed' ELSE 'open' END) AS status
       FROM ${TABLES.tasks} t
       WHERE t.id = ? LIMIT 1`
    )
    .get(id) as
      | { id: string; title: string | null; description: string | null; entity_type: string | null; entity_id: string | null; task_type_id: string | null; mode: string | null; assignee_id: string | null; due_at: string | null; completed_at: string | null; outcome: string | null; created_at: string | null; updated_at: string | null; is_ai_copy: number | null; status: string }
      | undefined;
  if (!row) return null;

  const related = resolveRelatedRecord(db, row.entity_type, row.entity_id);

  const taskType = row.task_type_id
    ? db
        .prepare(`SELECT label, color FROM ${TABLES.task_types} WHERE id = ? LIMIT 1`)
        .get(row.task_type_id) as { label: string | null; color: string | null } | undefined
    : undefined;

  const assignee = row.assignee_id
    ? db
        .prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`)
        .get(row.assignee_id) as { name: string | null } | undefined
    : undefined;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    relatedRecordName: related?.name ?? null,
    companyName: related?.companyName ?? null,
    assignee_id: row.assignee_id,
    assigneeName: assignee?.name ?? null,
    task_type_id: row.task_type_id,
    taskTypeLabel: taskType?.label ?? null,
    taskTypeColor: taskType?.color ?? null,
    mode: row.mode,
    due_at: row.due_at,
    completed_at: row.completed_at,
    outcome: row.outcome,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status === "completed" ? "completed" : "open",
    lead_id: row.entity_type === "lead" ? row.entity_id : null,
    deal_id: row.entity_type === "deal" ? row.entity_id : null,
    establishment_id: row.entity_type === "establishment" ? row.entity_id : null,
    isAiCopy: row.is_ai_copy === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Related record summary                                              */
/* ------------------------------------------------------------------ */

/** Resolve the related record for a task (used by the API route). */
export function getTaskRelatedRecord(
  entityType: string | null,
  entityId: string | null
): TaskRelatedRecord | null {
  if (!entityType || !entityId) return null;
  const db = getDb();
  return resolveRelatedRecord(db, entityType, entityId);
}

/* ------------------------------------------------------------------ */
/* Filter options                                                     */
/* ------------------------------------------------------------------ */

/** Options used to populate the task list filters. */
export function getTaskFilterOptions(): TaskFilterOptions {
  const db = getDb();
  const assignees = db
    .prepare(
      `SELECT DISTINCT t.assignee_id AS id, u.name AS name
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       WHERE t.assignee_id IS NOT NULL
       ORDER BY u.name ASC`
    )
    .all() as { id: string; name: string }[];
  const uniqueAssignees = Array.from(
    new Map(assignees.map((a) => [a.id, a])).values()
  );
  const taskTypes = db
    .prepare(
      `SELECT id, label, color, sort_order
       FROM ${TABLES.task_types}
       WHERE is_archived IS NULL OR is_archived = 0
       ORDER BY sort_order ASC`
    )
    .all() as { id: string; label: string | null; color: string | null; sort_order: number | null }[];
  const entityTypes = (
    db
      .prepare(`SELECT DISTINCT entity_type FROM ${TABLES.tasks} WHERE entity_type IS NOT NULL ORDER BY entity_type ASC`)
      .all() as { entity_type: string }[]
  ).map((r) => r.entity_type);

  return {
    assignees: uniqueAssignees,
    taskTypes: taskTypes.map((t) => ({ id: t.id, label: t.label, color: t.color, sort_order: t.sort_order })),
    entityTypes,
  };
}

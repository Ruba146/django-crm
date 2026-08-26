import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  DealActivity,
  DealDetail,
  DealFilterOptions,
  DealListItem,
  DealTask,
  PipelineStage,
} from "@/types";

/**
 * Deal service — reads live data from the existing SQLite CRM database.
 *
 * Deals are stored in the `deals` table. A deal references a company via
 * `establishments` (through `deals.establishment_id`), a lead via
 * `deals.lead_id`, a pipeline stage via `pipeline_stages` (pipeline = 'deal'),
 * and an owner via `users`. Activities and tasks are attached to the deal
 * entity directly (`entity_type = 'deal'`).
 *
 * Every SQL query stays here. No React component ever touches the database.
 * Functions are synchronous (better-sqlite3) and single-responsibility.
 */

/* ------------------------------------------------------------------ */
/* Paginated list view                                                 */
/* ------------------------------------------------------------------ */

interface DealPageRow {
  id: string;
  name: string | null;
  company: string | null;
  lead_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  terminal_type: string | null;
  expected_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  target_close_date: string | null;
  created_at: string | null;
  is_ai_copy: number | null;
}

export interface DealPageResult {
  records: DealListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getDealsPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  ownerId?: string;
  stageId?: string;
  statusId?: string;
  createdFrom?: string;
  createdTo?: string;
}): DealPageResult {
  const db = getDb();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const offset = (page - 1) * pageSize;
  const term = params.search?.trim() ? `%${params.search.trim()}%` : null;

  const where = ["d.deleted_at IS NULL"];
  const queryParams: unknown[] = [];

  if (term) {
    where.push(
      `(d.name LIKE ? OR COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = d.establishment_id), '') LIKE ? OR COALESCE((SELECT full_name FROM ${TABLES.leads} WHERE id = d.lead_id), '') LIKE ?)`
    );
    queryParams.push(term, term, term);
  }
  if (params.ownerId) {
    where.push("d.owner_id = ?");
    queryParams.push(params.ownerId);
  }
  if (params.stageId) {
    where.push("d.stage_id = ?");
    queryParams.push(params.stageId);
  }
  if (params.statusId) {
    where.push(
      `(SELECT terminal_type FROM ${TABLES.stages} WHERE id = d.stage_id) = ?`
    );
    queryParams.push(params.statusId);
  }
  if (params.createdFrom) {
    where.push("d.created_at >= ?");
    queryParams.push(params.createdFrom + "T00:00:00");
  }
  if (params.createdTo) {
    where.push("d.created_at <= ?");
    queryParams.push(params.createdTo + "T23:59:59");
  }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  const countRow = db
    .prepare(
      `SELECT COUNT(DISTINCT d.id) as cnt FROM ${TABLES.deals} d ${whereSql}`
    )
    .get(...queryParams) as { cnt: number };

  const rows = db
    .prepare(
      `WITH deduped_deals AS (
        SELECT id, MAX(name) AS name, MAX(establishment_id) AS establishment_id, MAX(lead_id) AS lead_id,
               MAX(owner_id) AS owner_id, MAX(stage_id) AS stage_id,
               MAX(expected_value_minor) AS expected_value_minor, MAX(currency_code) AS currency_code,
               MAX(probability_pct) AS probability_pct, MAX(target_close_date) AS target_close_date,
               MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy,
               MAX(deleted_at) AS deleted_at
        FROM ${TABLES.deals}
        WHERE deleted_at IS NULL
        GROUP BY id
      )
      SELECT
        dd.id,
        dd.name,
        COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = dd.establishment_id), '') AS company,
        COALESCE((SELECT full_name FROM ${TABLES.leads} WHERE id = dd.lead_id), '') AS lead_name,
        dd.owner_id,
        COALESCE((SELECT name FROM ${TABLES.users} WHERE id = dd.owner_id), '') AS owner_name,
        dd.stage_id,
        COALESCE((SELECT label FROM ${TABLES.stages} WHERE id = dd.stage_id), '') AS stage_label,
        COALESCE((SELECT color FROM ${TABLES.stages} WHERE id = dd.stage_id), '') AS stage_color,
        COALESCE((SELECT terminal_type FROM ${TABLES.stages} WHERE id = dd.stage_id), '') AS terminal_type,
        dd.expected_value_minor,
        dd.currency_code,
        dd.probability_pct,
        dd.target_close_date,
        dd.created_at,
        dd.is_ai_copy
      FROM deduped_deals dd
      ${whereSql.replace(/d\./g, "dd.")}
      ORDER BY dd.created_at DESC, dd.id ASC
      LIMIT ? OFFSET ?`
    )
    .all(...queryParams, pageSize, offset) as DealPageRow[];

  const total = Number(countRow?.cnt ?? 0);
  return {
    records: rows.map((r) => ({
      id: r.id,
      name: r.name,
      company: r.company || null,
      leadName: r.lead_name || null,
      ownerName: r.owner_name || null,
      stage:
        r.stage_label != null
          ? { label: r.stage_label, color: r.stage_color }
          : null,
      expected_value_minor: r.expected_value_minor,
      currency_code: r.currency_code,
      probability_pct: r.probability_pct,
      target_close_date: r.target_close_date,
      created_at: r.created_at,
      status: r.terminal_type,
      stageId: r.stage_id,
      ownerId: r.owner_id,
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

interface DealRow {
  id: string;
  name: string | null;
  company: string | null;
  lead_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  terminal_type: string | null;
  expected_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  target_close_date: string | null;
  created_at: string | null;
  is_ai_copy: number | null;
}

/** Active deals enriched with company, lead, stage, owner and value. */
export function getDeals(limit?: number): DealListItem[] {
  const db = getDb();
  const sql = `SELECT
       d.id,
       d.name,
       COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = d.establishment_id), '') AS company,
       COALESCE((SELECT full_name FROM ${TABLES.leads} WHERE id = d.lead_id), '') AS lead_name,
       d.owner_id,
       COALESCE((SELECT name FROM ${TABLES.users} WHERE id = d.owner_id), '') AS owner_name,
       d.stage_id,
       COALESCE((SELECT label FROM ${TABLES.stages} WHERE id = d.stage_id), '') AS stage_label,
       COALESCE((SELECT color FROM ${TABLES.stages} WHERE id = d.stage_id), '') AS stage_color,
       COALESCE((SELECT terminal_type FROM ${TABLES.stages} WHERE id = d.stage_id), '') AS terminal_type,
       d.expected_value_minor,
       d.currency_code,
       d.probability_pct,
       d.target_close_date,
       d.created_at,
       d.is_ai_copy
     FROM ${TABLES.deals} d
     WHERE d.deleted_at IS NULL
     ORDER BY d.created_at DESC
     ${limit ? `LIMIT ${limit}` : ""}`;
  const rows = db.prepare(sql).all() as DealRow[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    company: r.company || null,
    leadName: r.lead_name || null,
    ownerName: r.owner_name || null,
    stage:
      r.stage_label != null
        ? { label: r.stage_label, color: r.stage_color }
        : null,
    expected_value_minor: r.expected_value_minor,
    currency_code: r.currency_code,
    probability_pct: r.probability_pct,
    target_close_date: r.target_close_date,
    created_at: r.created_at,
    status: r.terminal_type,
    stageId: r.stage_id,
    ownerId: r.owner_id,
    isAiCopy: r.is_ai_copy === 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Deal detail                                                        */
/* ------------------------------------------------------------------ */

interface DealDetailRow {
  id: string;
  name: string | null;
  company: string | null;
  lead_name: string | null;
  owner_name: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  terminal_type: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  probability_pct: number | null;
  currency_code: string | null;
  target_close_date: string | null;
  actual_close_date: string | null;
  contract_length_months: number | null;
  mrr_minor: number | null;
  seat_count: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_ai_copy: number | null;
}

/**
 * Full deal detail for the split-view panel — deal row enriched with company
 * name, lead name, owner name and pipeline stage.
 */
export function getDealDetail(id: string): DealDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         d.id,
         d.name,
         e.name AS company,
         l.full_name AS lead_name,
         u.name AS owner_name,
         d.stage_id,
         ps.label AS stage_label,
         ps.color AS stage_color,
         ps.terminal_type,
         d.expected_value_minor,
         d.won_value_minor,
         d.probability_pct,
         d.currency_code,
         d.target_close_date,
         d.actual_close_date,
         d.contract_length_months,
         d.mrr_minor,
         d.seat_count,
         d.notes,
         d.created_at,
         d.updated_at,
         d.is_ai_copy
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
       LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id
       LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
       LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
       WHERE d.id = ? AND d.deleted_at IS NULL
       LIMIT 1`
    )
    .get(id) as DealDetailRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    company: row.company,
    leadName: row.lead_name,
    ownerName: row.owner_name,
    stage:
      row.stage_label != null
        ? { label: row.stage_label, color: row.stage_color }
        : null,
    expected_value_minor: row.expected_value_minor,
    won_value_minor: row.won_value_minor,
    probability_pct: row.probability_pct,
    currency_code: row.currency_code,
    target_close_date: row.target_close_date,
    actual_close_date: row.actual_close_date,
    contract_length_months: row.contract_length_months,
    mrr_minor: row.mrr_minor,
    seat_count: row.seat_count,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.terminal_type,
    isAiCopy: row.is_ai_copy === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Activities, tasks                                                  */
/* ------------------------------------------------------------------ */

/** Timeline activities for a deal, ordered by date (newest first). */
export function getDealActivities(id: string, limit = 50): DealActivity[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         a.id,
         at.label     AS activity_type_label,
         at.color     AS activity_type_color,
         a.direction,
         a.body,
         a.entity_type,
         u.name       AS user_name,
         a.occurred_at
       FROM ${TABLES.activities} a
       LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
       WHERE a.entity_type = 'deal' AND a.entity_id = ?
       ORDER BY a.occurred_at DESC, a.created_at DESC
       LIMIT ?`
    )
    .all(id, limit) as DealActivity[];
}

/** Tasks attached to a deal, open first. */
export function getDealTasks(id: string, limit = 50): DealTask[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         t.id,
         t.title,
         tt.label     AS task_type_label,
         tt.color     AS task_type_color,
         t.due_at,
         t.completed_at,
         u.name       AS assignee_name,
         t.mode
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       WHERE t.entity_type = 'deal' AND t.entity_id = ?
       ORDER BY (t.completed_at IS NOT NULL) ASC, t.due_at ASC
       LIMIT ?`
    )
    .all(id, limit) as DealTask[];
}

/* ------------------------------------------------------------------ */
/* Filter options                                                     */
/* ------------------------------------------------------------------ */

/** Options used to populate the deal list filters. */
export function getDealFilterOptions(): DealFilterOptions {
  const db = getDb();
  const owners = db
    .prepare(
      `SELECT DISTINCT d.owner_id AS id, u.name AS name
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
       WHERE d.owner_id IS NOT NULL AND d.deleted_at IS NULL
       ORDER BY u.name ASC`
    )
    .all() as { id: string; name: string }[];
  const uniqueOwners = Array.from(
    new Map(owners.map((o) => [o.id, o])).values()
  );
  const stages = db
    .prepare(
      `SELECT id, pipeline, label, color, sort_order, is_terminal, terminal_type
       FROM ${TABLES.stages}
       WHERE pipeline = 'deal' AND (is_archived IS NULL OR is_archived = 0)
       ORDER BY sort_order ASC`
    )
    .all() as PipelineStage[];
  const statuses = db
    .prepare(
      `SELECT id, pipeline, label, color, sort_order, is_terminal, terminal_type
       FROM ${TABLES.stages}
       WHERE pipeline = 'deal'
         AND (is_terminal IS NULL OR is_terminal = 1)
         AND (is_archived IS NULL OR is_archived = 0)
       ORDER BY sort_order ASC`
    )
    .all() as PipelineStage[];

  return { owners: uniqueOwners, stages, statuses };
}

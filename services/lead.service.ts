import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  LeadActivity,
  LeadDeal,
  LeadDetail,
  LeadFilterOptions,
  LeadListItem,
  LeadTask,
  PipelineStage,
  Source,
} from "@/types";

/**
 * Lead service — reads live data from the existing SQLite CRM database.
 *
 * Leads are stored in the `leads` table. A lead may reference a company via
 * `establishments` (through `leads.establishment_id`), a contact via
 * `contacts` (whichever relates to its establishment), source via `sources`,
 * pipeline stage via `pipeline_stages` (pipeline = 'lead') and owner via
 * `users`. Deals are linked directly through `deals.lead_id`. Activities and
 * tasks are attached to either the lead entity or its deals, so they are
 * resolved across both.
 *
 * Every SQL query stays here. No React component ever touches the database.
 * Functions are synchronous (better-sqlite3) and single-responsibility.
 */

/* ------------------------------------------------------------------ */
/* Paginated list view                                                 */
/* ------------------------------------------------------------------ */

interface LeadPageRow {
  id: string;
  full_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  company: string | null;
  source_id: string | null;
  source_label: string | null;
  source_color: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  is_terminal: number | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string | null;
  last_activity_at: string | null;
  probability_pct: number | null;
  is_ai_copy: number | null;
}

export interface LeadPageResult {
  records: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getLeadsPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  ownerId?: string;
  sourceId?: string;
  stageId?: string;
  createdFrom?: string;
  createdTo?: string;
}): LeadPageResult {
  const db = getDb();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const offset = (page - 1) * pageSize;
  const term = params.search?.trim() ? `%${params.search.trim()}%` : null;

  const where = ["l.deleted_at IS NULL", "l.merged_into_id IS NULL"];
  const queryParams: unknown[] = [];

  if (term) {
    where.push(
      `(l.full_name LIKE ? OR COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = l.establishment_id), '') LIKE ? OR COALESCE(l.normalized_email, '') LIKE ? OR COALESCE(l.normalized_phone, '') LIKE ?)`
    );
    queryParams.push(term, term, term, term);
  }
  if (params.ownerId) {
    where.push("l.owner_id = ?");
    queryParams.push(params.ownerId);
  }
  if (params.sourceId) {
    where.push("l.primary_source_id = ?");
    queryParams.push(params.sourceId);
  }
  if (params.stageId) {
    where.push("l.stage_id = ?");
    queryParams.push(params.stageId);
  }
  if (params.createdFrom) {
    where.push("l.created_at >= ?");
    queryParams.push(params.createdFrom + "T00:00:00");
  }
  if (params.createdTo) {
    where.push("l.created_at <= ?");
    queryParams.push(params.createdTo + "T23:59:59");
  }

  const whereSql = "WHERE " + where.join(" AND ");

  const countRow = db
    .prepare(
      `SELECT COUNT(DISTINCT l.id) as cnt FROM ${TABLES.leads} l ${whereSql}`
    )
    .get(...queryParams) as { cnt: number };

  const rows = db
    .prepare(
      `WITH deduped_leads AS (
        SELECT id, MAX(full_name) AS full_name, MAX(normalized_phone) AS normalized_phone,
               MAX(normalized_email) AS normalized_email, MAX(establishment_id) AS establishment_id,
               MAX(primary_source_id) AS primary_source_id, MAX(stage_id) AS stage_id,
               MAX(owner_id) AS owner_id, MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy,
               MAX(deleted_at) AS deleted_at, MAX(merged_into_id) AS merged_into_id
        FROM ${TABLES.leads}
        WHERE deleted_at IS NULL AND merged_into_id IS NULL
        GROUP BY id
      )
      SELECT
        dl.id,
        dl.full_name,
        dl.normalized_phone,
        dl.normalized_email,
        COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = dl.establishment_id), '') AS company,
        dl.primary_source_id AS source_id,
        COALESCE((SELECT label FROM ${TABLES.sources} WHERE id = dl.primary_source_id), '') AS source_label,
        COALESCE((SELECT color FROM ${TABLES.sources} WHERE id = dl.primary_source_id), '') AS source_color,
        dl.stage_id,
        COALESCE((SELECT label FROM ${TABLES.stages} WHERE id = dl.stage_id), '') AS stage_label,
        COALESCE((SELECT color FROM ${TABLES.stages} WHERE id = dl.stage_id), '') AS stage_color,
        COALESCE((SELECT is_terminal FROM ${TABLES.stages} WHERE id = dl.stage_id), 0) AS is_terminal,
        dl.owner_id,
        COALESCE((SELECT name FROM ${TABLES.users} WHERE id = dl.owner_id), '') AS owner_name,
        dl.created_at,
        dl.is_ai_copy,
        (
          SELECT MAX(a.occurred_at)
          FROM ${TABLES.activities} a
          WHERE a.entity_type = 'lead' AND a.entity_id = dl.id
             OR a.entity_type = 'deal' AND a.entity_id IN (
               SELECT d.id FROM ${TABLES.deals} d WHERE d.lead_id = dl.id AND d.deleted_at IS NULL
             )
        ) AS last_activity_at,
        (
          SELECT MAX(d.probability_pct)
          FROM ${TABLES.deals} d
          WHERE d.lead_id = dl.id AND d.deleted_at IS NULL
        ) AS probability_pct
      FROM deduped_leads dl
      ${whereSql.replace(/l\./g, "dl.")}
      ORDER BY dl.created_at DESC, dl.id ASC
      LIMIT ? OFFSET ?`
    )
    .all(...queryParams, pageSize, offset) as LeadPageRow[];

  const total = Number(countRow?.cnt ?? 0);
  return {
    records: rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.normalized_phone,
      email: r.normalized_email,
      company: r.company || null,
      source:
        r.source_label != null
          ? { label: r.source_label, color: r.source_color }
          : null,
      stage:
        r.stage_label != null ? { label: r.stage_label, color: r.stage_color } : null,
      status:
        r.stage_label != null && (r.is_terminal ?? 0) === 1
          ? { label: r.stage_label, color: r.stage_color }
          : null,
      ownerName: r.owner_name,
      created_at: r.created_at,
      last_activity_at: r.last_activity_at,
      probability_pct: r.probability_pct,
      sourceId: r.source_id,
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

interface LeadRow {
  id: string;
  full_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  company: string | null;
  source_id: string | null;
  source_label: string | null;
  source_color: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  is_terminal: number | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string | null;
  last_activity_at: string | null;
  probability_pct: number | null;
  is_ai_copy: number | null;
}

/** Active leads enriched with company, source, stage, owner and activity. */
export function getLeads(): LeadListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         l.id,
         l.full_name,
         l.normalized_phone,
         l.normalized_email,
         COALESCE((SELECT name FROM ${TABLES.customers} WHERE id = l.establishment_id), '') AS company,
         l.primary_source_id AS source_id,
         COALESCE((SELECT label FROM ${TABLES.sources} WHERE id = l.primary_source_id), '') AS source_label,
         COALESCE((SELECT color FROM ${TABLES.sources} WHERE id = l.primary_source_id), '') AS source_color,
         l.stage_id,
         COALESCE((SELECT label FROM ${TABLES.stages} WHERE id = l.stage_id), '') AS stage_label,
         COALESCE((SELECT color FROM ${TABLES.stages} WHERE id = l.stage_id), '') AS stage_color,
         COALESCE((SELECT is_terminal FROM ${TABLES.stages} WHERE id = l.stage_id), 0) AS is_terminal,
         l.owner_id,
         COALESCE((SELECT name FROM ${TABLES.users} WHERE id = l.owner_id), '') AS owner_name,
         l.created_at,
         l.is_ai_copy,
         (
           SELECT MAX(a.occurred_at)
           FROM ${TABLES.activities} a
           WHERE a.entity_type = 'lead' AND a.entity_id = l.id
              OR a.entity_type = 'deal' AND a.entity_id IN (
                SELECT d.id FROM ${TABLES.deals} d
                WHERE d.lead_id = l.id AND d.deleted_at IS NULL
              )
         ) AS last_activity_at,
         (
           SELECT MAX(d.probability_pct)
           FROM ${TABLES.deals} d
           WHERE d.lead_id = l.id AND d.deleted_at IS NULL
         ) AS probability_pct
       FROM ${TABLES.leads} l
       WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
       ORDER BY l.created_at DESC`
    )
    .all() as LeadRow[];

  const unique = Array.from(new Map(rows.map((r) => [r.id, r])).values());

  return unique.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.normalized_phone,
    email: r.normalized_email,
    company: r.company || null,
    source:
      r.source_label != null
        ? { label: r.source_label, color: r.source_color }
        : null,
    stage:
      r.stage_label != null ? { label: r.stage_label, color: r.stage_color } : null,
    status:
      r.stage_label != null && (r.is_terminal ?? 0) === 1
        ? { label: r.stage_label, color: r.stage_color }
        : null,
    ownerName: r.owner_name,
    created_at: r.created_at,
    last_activity_at: r.last_activity_at,
    probability_pct: r.probability_pct,
    sourceId: r.source_id,
    stageId: r.stage_id,
    ownerId: r.owner_id,
    isAiCopy: r.is_ai_copy === 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Lead detail                                                        */
/* ------------------------------------------------------------------ */

interface LeadDetailRow {
  id: string;
  full_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  company: string | null;
  company_city: string | null;
  notes: string | null;
  stage_id: string | null;
  stage_label: string | null;
  stage_color: string | null;
  is_terminal: number | null;
  source_id: string | null;
  source_label: string | null;
  source_color: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  probability_pct: number | null;
  is_ai_copy: number | null;
}

/**
 * Full lead detail for the split-view panel, with a phone/email fallback to
 * the primary contact of the lead's company when the lead itself has none.
 */
export function getLeadDetail(id: string): LeadDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         l.id,
         l.full_name,
         l.normalized_phone,
         l.normalized_email,
         e.name      AS company,
         e.city      AS company_city,
         l.notes,
         l.stage_id,
         ps.label    AS stage_label,
         ps.color    AS stage_color,
         ps.is_terminal,
         l.primary_source_id AS source_id,
         s.label     AS source_label,
         s.color     AS source_color,
         l.owner_id,
         u.name      AS owner_name,
         l.created_at,
         l.updated_at,
         l.is_ai_copy,
         (
           SELECT MAX(d.probability_pct)
           FROM ${TABLES.deals} d
           WHERE d.lead_id = l.id AND d.deleted_at IS NULL
         ) AS probability_pct
       FROM ${TABLES.leads} l
       LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id
       LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
       LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
       LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
       WHERE l.id = ? AND l.deleted_at IS NULL AND l.merged_into_id IS NULL
       LIMIT 1`
    )
    .get(id) as LeadDetailRow | undefined;

  if (!row) return null;

  let phone = row.normalized_phone;
  let email = row.normalized_email;
  if (!phone || !email) {
    const contact = db
      .prepare(
        `SELECT phone, email
         FROM ${TABLES.contacts}
         WHERE establishment_id = (
           SELECT establishment_id FROM ${TABLES.leads} WHERE id = ?
         )
         AND deleted_at IS NULL
         AND (phone IS NOT NULL OR email IS NOT NULL)
         ORDER BY created_at ASC
         LIMIT 1`
      )
      .get(id) as { phone: string | null; email: string | null } | undefined;
    if (contact) {
      phone = phone ?? contact.phone;
      email = email ?? contact.email;
    }
  }

  return {
    id: row.id,
    full_name: row.full_name,
    phone,
    email,
    company: row.company,
    companyCity: row.company_city,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source:
      row.source_label != null
        ? { label: row.source_label, color: row.source_color }
        : null,
    stage:
      row.stage_label != null ? { label: row.stage_label, color: row.stage_color } : null,
    status:
      row.stage_label != null && (row.is_terminal ?? 0) === 1
        ? { label: row.stage_label, color: row.stage_color }
        : null,
    ownerName: row.owner_name,
    probability_pct: row.probability_pct,
    isAiCopy: row.is_ai_copy === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Activities, deals, tasks                                           */
/* ------------------------------------------------------------------ */

/**
 * Timeline activities for a lead — both directly attached to the lead and to
 * its deals — ordered by date (newest first).
 */
export function getLeadActivities(id: string, limit = 50): LeadActivity[] {
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
       WHERE (
         (a.entity_type = 'lead' AND a.entity_id = ?)
         OR
         (a.entity_type = 'deal' AND a.entity_id IN (
           SELECT d.id FROM ${TABLES.deals} d
           WHERE d.lead_id = ? AND d.deleted_at IS NULL
         ))
       )
       ORDER BY a.occurred_at DESC, a.created_at DESC
       LIMIT ?`
    )
    .all(id, id, limit) as LeadActivity[];
}

/** Deals belonging to a lead, enriched with stage + owner. */
export function getLeadDeals(id: string): LeadDeal[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         d.id,
         d.name,
         s.label AS stage_label,
         s.color AS stage_color,
         d.expected_value_minor,
         d.probability_pct,
         d.currency_code,
         u.name  AS owner_name,
         s.terminal_type AS status
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
       LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
       WHERE d.lead_id = ? AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`
    )
    .all(id) as LeadDeal[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows;
}

/** Tasks attached to a lead or its deals, open first. */
export function getLeadTasks(id: string, limit = 50): LeadTask[] {
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
       WHERE (
         (t.entity_type = 'lead' AND t.entity_id = ?)
         OR
         (t.entity_type = 'deal' AND t.entity_id IN (
           SELECT d.id FROM ${TABLES.deals} d
           WHERE d.lead_id = ? AND d.deleted_at IS NULL
         ))
       )
       ORDER BY (t.completed_at IS NOT NULL) ASC, t.due_at ASC
       LIMIT ?`
    )
    .all(id, id, limit) as LeadTask[];
}

/* ------------------------------------------------------------------ */
/* Filter options                                                     */
/* ------------------------------------------------------------------ */

/** Options used to populate the lead list filters. */
export function getLeadFilterOptions(): LeadFilterOptions {
  const db = getDb();
  const sources = db
    .prepare(
      `SELECT id, label, color, sort_order, adapter_key
       FROM ${TABLES.sources}
       WHERE is_archived IS NULL OR is_archived = 0
       ORDER BY sort_order ASC`
    )
    .all() as Source[];
  const owners = db
    .prepare(
      `SELECT DISTINCT l.owner_id AS id, u.name AS name
       FROM ${TABLES.leads} l
       LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
       WHERE l.owner_id IS NOT NULL AND l.deleted_at IS NULL AND l.merged_into_id IS NULL
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
       WHERE pipeline = 'lead' AND (is_archived IS NULL OR is_archived = 0)
       ORDER BY sort_order ASC`
    )
    .all() as PipelineStage[];

  return { sources, owners: uniqueOwners, stages };
}


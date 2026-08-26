import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  Contact,
  CustomerActivity,
  CustomerDeal,
  CustomerDetail,
  CustomerFilterOptions,
  CustomerListItem,
  CustomerStatistics,
  CustomerTask,
  Industry,
  Lead,
  PipelineStage,
  Source,
} from "@/types";

/**
 * Customer service — reads live data from the existing SQLite CRM database.
 *
 * Customers are stored in the `establishments` table. Source, status and
 * owner are derived from the associated lead(s) (`leads.establishment_id`),
 * the primary contact from `contacts`, and deals directly via
 * `deals.establishment_id`. Activities and tasks are attached to the
 * lead/deal entities, so they are resolved through those tables.
 *
 * Every SQL query stays here. No React component ever touches the database.
 * Functions are synchronous (better-sqlite3) and single-responsibility.
 */

/* ------------------------------------------------------------------ */
/* Paginated list view                                                 */
/* ------------------------------------------------------------------ */

interface CustomerPageRow {
  id: string;
  name: string | null;
  city: string | null;
  commercial_registration_number: string | null;
  created_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry_id: string | null;
  industry_label: string | null;
  industry_color: string | null;
  source_id: string | null;
  source_label: string | null;
  source_color: string | null;
  status_id: string | null;
  status_label: string | null;
  status_color: string | null;
  owner_id: string | null;
  owner_name: string | null;
  is_ai_copy: number | null;
}

export interface CustomerPageResult {
  records: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getCustomersPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  industryId?: string;
  sourceId?: string;
  ownerId?: string;
  statusId?: string;
}): CustomerPageResult {
  const db = getDb();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const offset = (page - 1) * pageSize;
  const term = params.search?.trim() ? `%${params.search.trim()}%` : null;

  const where = ["e.deleted_at IS NULL"];
  const queryParams: unknown[] = [];

  if (term) {
    where.push(
      `(e.name LIKE ? OR COALESCE(e.city, '') LIKE ?)`
    );
    queryParams.push(term, term);
  }
  if (params.industryId) {
    where.push("e.industry_id = ?");
    queryParams.push(params.industryId);
  }

  const whereSql = "WHERE " + where.join(" AND ");

  const countRow = db
    .prepare(
      `SELECT COUNT(DISTINCT e.id) as cnt FROM ${TABLES.customers} e ${whereSql}`
    )
    .get(...queryParams) as { cnt: number };

  const rows = db
    .prepare(
      `WITH deduped_customers AS (
        SELECT id, MAX(name) AS name, MAX(city) AS city,
               MAX(commercial_registration_number) AS commercial_registration_number,
               MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy,
               MAX(industry_id) AS industry_id, MAX(deleted_at) AS deleted_at
        FROM ${TABLES.customers}
        WHERE deleted_at IS NULL
        GROUP BY id
      )
      SELECT
        dc.id,
        dc.name,
        dc.city,
        dc.commercial_registration_number,
        dc.created_at,
        dc.is_ai_copy,
        COALESCE(
          (SELECT c.full_name FROM ${TABLES.contacts} c WHERE c.establishment_id = dc.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
          ''
        ) AS contact_name,
        COALESCE(
          (SELECT c.email FROM ${TABLES.contacts} c WHERE c.establishment_id = dc.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
          ''
        ) AS contact_email,
        COALESCE(
          (SELECT c.phone FROM ${TABLES.contacts} c WHERE c.establishment_id = dc.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
          ''
        ) AS contact_phone,
        dc.industry_id,
        COALESCE((SELECT label FROM ${TABLES.industries} WHERE id = dc.industry_id), '') AS industry_label,
        COALESCE((SELECT color FROM ${TABLES.industries} WHERE id = dc.industry_id), '') AS industry_color,
        COALESCE(
          (SELECT l.primary_source_id FROM ${TABLES.leads} l WHERE l.establishment_id = dc.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
          ''
        ) AS source_id,
        COALESCE(
          (SELECT s.label FROM ${TABLES.sources} s INNER JOIN ${TABLES.leads} l2 ON l2.primary_source_id = s.id WHERE l2.establishment_id = dc.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
          ''
        ) AS source_label,
        COALESCE(
          (SELECT s.color FROM ${TABLES.sources} s INNER JOIN ${TABLES.leads} l2 ON l2.primary_source_id = s.id WHERE l2.establishment_id = dc.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
          ''
        ) AS source_color,
        COALESCE(
          (SELECT l.stage_id FROM ${TABLES.leads} l WHERE l.establishment_id = dc.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
          ''
        ) AS status_id,
        COALESCE(
          (SELECT ps.label FROM ${TABLES.stages} ps INNER JOIN ${TABLES.leads} l2 ON l2.stage_id = ps.id WHERE l2.establishment_id = dc.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
          ''
        ) AS status_label,
        COALESCE(
          (SELECT ps.color FROM ${TABLES.stages} ps INNER JOIN ${TABLES.leads} l2 ON l2.stage_id = ps.id WHERE l2.establishment_id = dc.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
          ''
        ) AS status_color,
        COALESCE(
          (SELECT l.owner_id FROM ${TABLES.leads} l WHERE l.establishment_id = dc.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
          ''
        ) AS owner_id,
        COALESCE(
          (SELECT u.name FROM ${TABLES.users} u INNER JOIN ${TABLES.leads} l2 ON l2.owner_id = u.id WHERE l2.establishment_id = dc.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
          ''
        ) AS owner_name
      FROM deduped_customers dc
      ${whereSql.replace(/e\./g, "dc.")}
      ORDER BY dc.created_at DESC, dc.id ASC
      LIMIT ? OFFSET ?`
    )
    .all(...queryParams, pageSize, offset) as CustomerPageRow[];

  let records = rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    commercial_registration_number: r.commercial_registration_number,
    created_at: r.created_at,
    primaryContact:
      r.contact_name != null
        ? { name: r.contact_name, email: r.contact_email, phone: r.contact_phone }
        : null,
    industry:
      r.industry_label != null
        ? { label: r.industry_label, color: r.industry_color }
        : null,
    source:
      r.source_label != null ? { label: r.source_label, color: r.source_color } : null,
    status:
      r.status_label != null ? { label: r.status_label, color: r.status_color } : null,
    ownerName: r.owner_name,
    industryId: r.industry_id,
    sourceId: r.source_id,
    statusId: r.status_id,
    ownerId: r.owner_id,
    isAiCopy: r.is_ai_copy === 1,
  }));

  if (params.ownerId) {
    records = records.filter((c) => c.ownerId === params.ownerId);
  }
  if (params.sourceId) {
    records = records.filter((c) => c.sourceId === params.sourceId);
  }
  if (params.statusId) {
    records = records.filter((c) => c.statusId === params.statusId);
  }

  const total = Number(countRow?.cnt ?? 0);
  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/* ------------------------------------------------------------------ */
/* List view (legacy - kept for backward compatibility)               */
/* ------------------------------------------------------------------ */

interface CustomerRow {
  id: string;
  name: string | null;
  city: string | null;
  commercial_registration_number: string | null;
  created_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry_id: string | null;
  industry_label: string | null;
  industry_color: string | null;
  source_id: string | null;
  source_label: string | null;
  source_color: string | null;
  status_id: string | null;
  status_label: string | null;
  status_color: string | null;
  owner_id: string | null;
  owner_name: string | null;
  is_ai_copy: number | null;
}

/** Enriched customer rows for the list view, newest first. */
export function getCustomers(): CustomerListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         e.id,
         e.name,
         e.city,
         e.commercial_registration_number,
         e.created_at,
         e.is_ai_copy,
         COALESCE(
           (SELECT c.full_name FROM ${TABLES.contacts} c WHERE c.establishment_id = e.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
           ''
         ) AS contact_name,
         COALESCE(
           (SELECT c.email FROM ${TABLES.contacts} c WHERE c.establishment_id = e.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
           ''
         ) AS contact_email,
         COALESCE(
           (SELECT c.phone FROM ${TABLES.contacts} c WHERE c.establishment_id = e.id AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 1),
           ''
         ) AS contact_phone,
         e.industry_id,
         COALESCE((SELECT label FROM ${TABLES.industries} WHERE id = e.industry_id), '') AS industry_label,
         COALESCE((SELECT color FROM ${TABLES.industries} WHERE id = e.industry_id), '') AS industry_color,
         COALESCE(
           (SELECT l.primary_source_id FROM ${TABLES.leads} l WHERE l.establishment_id = e.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
           ''
         ) AS source_id,
         COALESCE(
           (SELECT s.label FROM ${TABLES.sources} s INNER JOIN ${TABLES.leads} l2 ON l2.primary_source_id = s.id WHERE l2.establishment_id = e.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
           ''
         ) AS source_label,
         COALESCE(
           (SELECT s.color FROM ${TABLES.sources} s INNER JOIN ${TABLES.leads} l2 ON l2.primary_source_id = s.id WHERE l2.establishment_id = e.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
           ''
         ) AS source_color,
         COALESCE(
           (SELECT l.stage_id FROM ${TABLES.leads} l WHERE l.establishment_id = e.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
           ''
         ) AS status_id,
         COALESCE(
           (SELECT ps.label FROM ${TABLES.stages} ps INNER JOIN ${TABLES.leads} l2 ON l2.stage_id = ps.id WHERE l2.establishment_id = e.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
           ''
         ) AS status_label,
         COALESCE(
           (SELECT ps.color FROM ${TABLES.stages} ps INNER JOIN ${TABLES.leads} l2 ON l2.stage_id = ps.id WHERE l2.establishment_id = e.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
           ''
         ) AS status_color,
         COALESCE(
           (SELECT l.owner_id FROM ${TABLES.leads} l WHERE l.establishment_id = e.id AND l.deleted_at IS NULL ORDER BY l.created_at ASC LIMIT 1),
           ''
         ) AS owner_id,
         COALESCE(
           (SELECT u.name FROM ${TABLES.users} u INNER JOIN ${TABLES.leads} l2 ON l2.owner_id = u.id WHERE l2.establishment_id = e.id AND l2.deleted_at IS NULL ORDER BY l2.created_at ASC LIMIT 1),
           ''
         ) AS owner_name
       FROM ${TABLES.customers} e
       WHERE e.deleted_at IS NULL
       ORDER BY e.created_at DESC`
    )
    .all() as CustomerRow[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    commercial_registration_number: r.commercial_registration_number,
    created_at: r.created_at,
    primaryContact:
      r.contact_name != null
        ? { name: r.contact_name, email: r.contact_email, phone: r.contact_phone }
        : null,
    industry:
      r.industry_label != null
        ? { label: r.industry_label, color: r.industry_color }
        : null,
    source:
      r.source_label != null ? { label: r.source_label, color: r.source_color } : null,
    status:
      r.status_label != null ? { label: r.status_label, color: r.status_color } : null,
    ownerName: r.owner_name,
    industryId: r.industry_id,
    sourceId: r.source_id,
    statusId: r.status_id,
    ownerId: r.owner_id,
    isAiCopy: r.is_ai_copy === 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Customer detail                                                    */
/* ------------------------------------------------------------------ */

interface BaseCustomerRow {
  id: string;
  name: string | null;
  commercial_registration_number: string | null;
  tax_number: string | null;
  city: string | null;
  address: string | null;
  num_branches: number | null;
  has_warehouse: number | null;
  num_pos: number | null;
  current_system: string | null;
  customer_requirements: string | null;
  expected_value_minor: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  industry_id: string | null;
  is_ai_copy: number | null;
}

/** Fetch the base establishment row for a customer id. */
function getBaseCustomer(id: string): BaseCustomerRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM ${TABLES.customers} WHERE id = ? LIMIT 1`)
    .get(id) as BaseCustomerRow | undefined;
  return row ?? null;
}

/** Get a single customer's contacts. */
function getCustomerContacts(id: string): Contact[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM ${TABLES.contacts} WHERE establishment_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    .all(id) as Contact[];
}

/** Join industry label/color for a customer. */
function getCustomerIndustry(industryId: string | null) {
  if (!industryId) return null;
  const db = getDb();
  const row = db
    .prepare(`SELECT label, color FROM ${TABLES.industries} WHERE id = ? LIMIT 1`)
    .get(industryId) as { label: string | null; color: string | null } | undefined;
  if (!row) return null;
  return { label: row.label, color: row.color };
}

interface LeadContextRow {
  source_label: string | null;
  source_color: string | null;
  status_label: string | null;
  status_color: string | null;
  owner_name: string | null;
}

/** Derive source/status/owner from the earliest associated lead. */
function getCustomerLeadContext(id: string): {
  source: { label: string | null; color: string | null } | null;
  status: { label: string | null; color: string | null } | null;
  ownerName: string | null;
} {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         s.label AS source_label,
         s.color AS source_color,
         ps.label AS status_label,
         ps.color AS status_color,
         u.name AS owner_name
       FROM ${TABLES.leads} l
       LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
       LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
       LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
       WHERE l.establishment_id = ? AND l.deleted_at IS NULL
       ORDER BY l.created_at ASC
       LIMIT 1`
    )
    .get(id) as LeadContextRow | undefined;

  if (!row) return { source: null, status: null, ownerName: null };
  return {
    source:
      row.source_label != null
        ? { label: row.source_label, color: row.source_color }
        : null,
    status:
      row.status_label != null
        ? { label: row.status_label, color: row.status_color }
        : null,
    ownerName: row.owner_name,
  };
}

/** Full customer detail for the split-view panel. */
export function getCustomerDetail(id: string): CustomerDetail | null {
  const base = getBaseCustomer(id);
  if (!base) return null;
  const contacts = getCustomerContacts(id);
  const industry = getCustomerIndustry(base.industry_id);
  const leadContext = getCustomerLeadContext(id);
  return {
    id: base.id,
    name: base.name,
    commercial_registration_number: base.commercial_registration_number,
    tax_number: base.tax_number,
    city: base.city,
    address: base.address,
    num_branches: base.num_branches,
    has_warehouse: base.has_warehouse,
    num_pos: base.num_pos,
    current_system: base.current_system,
    customer_requirements: base.customer_requirements,
    expected_value_minor: base.expected_value_minor,
    notes: base.notes,
    created_at: base.created_at,
    updated_at: base.updated_at,
    industry,
    source: leadContext.source,
    status: leadContext.status,
    ownerName: leadContext.ownerName,
    contacts,
    isAiCopy: base.is_ai_copy === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Statistics, deals, activities, tasks                               */
/* ------------------------------------------------------------------ */

interface StatsRow {
  deals_count: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_revenue_minor: number;
}

/** Statistics summary for a customer's deals, activities and tasks. */
export function getCustomerStatistics(id: string): CustomerStatistics | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         COUNT(d.id) AS deals_count,
         COALESCE(SUM(CASE WHEN d.deleted_at IS NULL AND (s.is_terminal IS NULL OR s.is_terminal = 0) THEN 1 ELSE 0 END), 0) AS open_deals,
         COALESCE(SUM(CASE WHEN s.terminal_type = 'won' THEN 1 ELSE 0 END), 0) AS won_deals,
         COALESCE(SUM(CASE WHEN s.terminal_type = 'lost' THEN 1 ELSE 0 END), 0) AS lost_deals,
         COALESCE(SUM(d.expected_value_minor), 0) AS total_revenue_minor
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
       WHERE d.establishment_id = ?`
    )
    .get(id) as StatsRow | undefined;

  if (!row) return null;

  const activitiesCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ${TABLES.activities} a
       WHERE (a.entity_type = 'lead' AND a.entity_id IN (
           SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
         OR (a.entity_type = 'deal' AND a.entity_id IN (
           SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL
         ))`
    )
    .get(id, id) as { c: number };

  const tasksCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ${TABLES.tasks} t
       WHERE (t.entity_type = 'lead' AND t.entity_id IN (
           SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
         OR (t.entity_type = 'deal' AND t.entity_id IN (
           SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL
         ))`
    )
    .get(id, id) as { c: number };

  const currency = db
    .prepare(
      `SELECT currency_code FROM ${TABLES.deals} WHERE establishment_id = ? AND currency_code IS NOT NULL LIMIT 1`
    )
    .get(id) as { currency_code: string } | undefined;

  return {
    dealsCount: Number(row.deals_count ?? 0),
    openDeals: Number(row.open_deals ?? 0),
    wonDeals: Number(row.won_deals ?? 0),
    lostDeals: Number(row.lost_deals ?? 0),
    activitiesCount: Number(activitiesCount?.c ?? 0),
    tasksCount: Number(tasksCount?.c ?? 0),
    totalRevenueMinor: Number(row.total_revenue_minor ?? 0),
    currency_code: currency?.currency_code ?? "SAR",
  };
}

/** Deals related to a customer, enriched with stage + owner. */
export function getCustomerDeals(id: string): CustomerDeal[] {
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
         u.name AS owner_name,
         s.terminal_type AS status
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
       LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
       WHERE d.establishment_id = ? AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`
    )
    .all(id) as CustomerDeal[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows;
}

/** Recent activities linked to a customer via its leads/deals. */
export function getCustomerActivities(id: string, limit = 10): CustomerActivity[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         a.id,
         at.label AS activity_type_label,
         at.color AS activity_type_color,
         a.direction,
         a.body,
         a.entity_type,
         u.name AS user_name,
         a.occurred_at
       FROM ${TABLES.activities} a
       LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
       WHERE (
         (a.entity_type = 'lead' AND a.entity_id IN (
           SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
         OR
         (a.entity_type = 'deal' AND a.entity_id IN (
           SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
       )
       ORDER BY a.occurred_at DESC, a.created_at DESC
       LIMIT ?`
    )
    .all(id, id, limit) as CustomerActivity[];
}

/** Tasks linked to a customer via its leads/deals, open first. */
export function getCustomerTasks(id: string, limit = 10): CustomerTask[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         t.id,
         t.title,
         tt.label AS task_type_label,
         tt.color AS task_type_color,
         t.due_at,
         t.completed_at,
         u.name AS assignee_name,
         t.mode
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       WHERE (
         (t.entity_type = 'lead' AND t.entity_id IN (
           SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
         OR
         (t.entity_type = 'deal' AND t.entity_id IN (
           SELECT id FROM ${TABLES.deals} WHERE establishment_id = ? AND deleted_at IS NULL
         ))
       )
       ORDER BY (t.completed_at IS NOT NULL) ASC, t.due_at ASC
       LIMIT ?`
    )
    .all(id, id, limit) as CustomerTask[];
}

/* ------------------------------------------------------------------ */
/* Filter options                                                     */
/* ------------------------------------------------------------------ */

/** Options used to populate the customer list filters. */
export function getCustomerFilterOptions(): CustomerFilterOptions {
  const db = getDb();
  const industries = db
    .prepare(
      `SELECT id, label, color, sort_order FROM ${TABLES.industries} WHERE is_archived IS NULL OR is_archived = 0 ORDER BY sort_order ASC`
    )
    .all() as Industry[];
  const sources = db
    .prepare(
      `SELECT id, label, color, sort_order, adapter_key FROM ${TABLES.sources} WHERE is_archived IS NULL OR is_archived = 0 ORDER BY sort_order ASC`
    )
    .all() as Source[];
  const owners = db
    .prepare(
      `SELECT DISTINCT l.owner_id AS id, u.name AS name
       FROM ${TABLES.leads} l
       LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
       WHERE l.owner_id IS NOT NULL AND l.deleted_at IS NULL
       ORDER BY u.name ASC`
    )
    .all() as { id: string; name: string }[];
  const uniqueOwners = Array.from(
    new Map(owners.map((o) => [o.id, o])).values()
  );
  const statuses = db
    .prepare(
      `SELECT id, pipeline, label, color, sort_order, is_terminal, terminal_type
       FROM ${TABLES.stages}
       WHERE (pipeline = 'lead') AND (is_archived IS NULL OR is_archived = 0)
       ORDER BY sort_order ASC`
    )
    .all() as PipelineStage[];

  return { industries, sources, owners: uniqueOwners, statuses };
}

/** Convenience: fetch a single raw lead used by the module (rarely needed). */
export function getCustomerLeads(id: string): Lead[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    .all(id) as Lead[];
}

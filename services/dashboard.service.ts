import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { countRows } from "@/lib/queries";
import type {
  DashboardStats,
  PipelineData,
  RecentActivity,
  RecentDeal,
  UpcomingTask,
} from "@/types";

/**
 * Dashboard service — reads live data from the SQLite CRM database.
 *
 * No fake data: every number/row comes from a real SQL query. Each function
 * has a single responsibility and all SQL stays here (never in components).
 */

/** Live aggregate counters for the KPI cards. */
export function getDashboardStats(): DashboardStats {
  return {
    customers: countRows(TABLES.customers, "deleted_at IS NULL"),
    leads: countRows(TABLES.leads, "deleted_at IS NULL AND merged_into_id IS NULL"),
    deals: countRows(TABLES.deals, "deleted_at IS NULL"),
    activities: countRows(TABLES.activities),
    tasks: countRows(TABLES.tasks, "completed_at IS NULL"),
  };
}

/**
 * Sales pipeline — every stage (read dynamically) plus the count and total
 * expected value of active deals in that stage. Stage names come from the
 * database; nothing is hardcoded. Ordered by the pipeline `sort_order`.
 */
export function getPipelineData(): PipelineData[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         s.id,
         s.label,
         s.color,
         s.pipeline,
         s.sort_order,
         COUNT(d.id)            AS dealCount,
         COALESCE(SUM(d.expected_value_minor), 0) AS totalValueMinor
       FROM ${TABLES.stages} s
       LEFT JOIN ${TABLES.deals} d
              ON d.stage_id = s.id
             AND d.deleted_at IS NULL
       WHERE s.is_archived IS NULL OR s.is_archived = 0
       GROUP BY s.id
       ORDER BY s.pipeline ASC, s.sort_order ASC`
    )
    .all() as Array<{
    id: string;
    label: string | null;
    color: string | null;
    pipeline: string | null;
    sort_order: number | null;
    dealCount: number;
    totalValueMinor: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    color: r.color,
    pipeline: r.pipeline,
    sort_order: r.sort_order,
    dealCount: Number(r.dealCount ?? 0),
    totalValueMinor: Number(r.totalValueMinor ?? 0),
  }));
}

/** Latest 10 activities joined with their type, entity and actor names. */
export function getRecentActivities(limit = 10): RecentActivity[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         a.id,
         at.label          AS activity_type_label,
         at.color          AS activity_type_color,
         a.direction,
         a.body,
         a.entity_type,
         CASE
           WHEN a.entity_type = 'establishment' THEN e.name
           WHEN a.entity_type = 'lead' THEN l.full_name
           WHEN a.entity_type = 'deal' THEN d.name
           ELSE a.entity_id
         END AS entity_name,
         u.name AS user_name,
         a.occurred_at
FROM ${TABLES.activities} a
       LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
       LEFT JOIN ${TABLES.customers} e ON a.entity_type = 'establishment' AND e.id = a.entity_id
       LEFT JOIN ${TABLES.leads} l ON a.entity_type = 'lead' AND l.id = a.entity_id
       LEFT JOIN ${TABLES.deals} d ON a.entity_type = 'deal' AND d.id = a.entity_id
       LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
       ORDER BY a.occurred_at DESC, a.created_at DESC
       LIMIT ?`
    )
    .all(limit) as RecentActivity[];
}

/** Next 10 open tasks ordered by due date, joined with type and assignee. */
export function getUpcomingTasks(limit = 10): UpcomingTask[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         t.id,
         t.title,
         tt.label     AS task_type_label,
         tt.color     AS task_type_color,
         t.due_at,
         u.name       AS assignee_name,
         t.mode
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
       WHERE t.completed_at IS NULL
         AND t.due_at IS NOT NULL
       ORDER BY t.due_at ASC
       LIMIT ?`
    )
    .all(limit) as UpcomingTask[];
}

/** Latest 5 deals joined with customer, stage and owner. */
export function getRecentDeals(limit = 5): RecentDeal[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         d.id,
         d.name,
         e.name          AS customer_name,
         s.label         AS stage_label,
         s.color         AS stage_color,
         d.expected_value_minor,
         d.currency_code,
         u.name          AS owner_name,
         d.created_at
FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
       LEFT JOIN ${TABLES.stages} s    ON s.id = d.stage_id
       LEFT JOIN ${TABLES.users} u     ON u.id = d.owner_id
       WHERE d.deleted_at IS NULL
       ORDER BY d.created_at DESC
       LIMIT ?`
    )
    .all(limit) as RecentDeal[];
}


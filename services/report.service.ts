import { getDb } from "@/lib/db";
import { TABLES, MINOR_UNIT } from "@/lib/definitions";
import type {
  ReportKpiCard,
  PipelineStageAnalytics,
  PipelineFunnel,
  WinLossAnalytics,
  RevenueByMonth,
  AverageDealSize,
  DealsByMonth,
  LeadBySource,
  LeadByStage,
  LeadConversionFunnel,
  TopSource,
  ActivityByType,
  ActivityByUser,
  ActivityByMonth,
  TaskByStatus,
  TaskByType,
  TaskByUser,
  OverdueTask,
  OwnerPerformance,
  RecentDeal,
  TopCustomer,
  ReportFilters,
  ReportData,
} from "@/types";

const MINOR = MINOR_UNIT;

function db() {
  return getDb();
}

function buildDateClause(range: { from: string; to: string }, columnPrefix = "d.created_at") {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (range.from) {
    conditions.push(`${columnPrefix} >= ?`);
    params.push(range.from);
  }
  if (range.to) {
    conditions.push(`${columnPrefix} <= ?`);
    params.push(range.to);
  }
  if (conditions.length > 0) {
    return { clause: ` AND ${conditions.join(" AND ")}`, params };
  }
  return { clause: "", params: [] as unknown[] };
}

function buildClause(condition: string | null) {
  return condition ? ` AND ${condition}` : "";
}

export function getReportData(filters: ReportFilters): ReportData {
  const database = db();

  const kpis = getDashboardKPIs(database, { filters });
  const pipeline = getPipelineAnalytics(database, { filters });
  const revenue = getRevenueAnalytics(database, { filters });
  const leads = getLeadAnalytics(database, { filters });
  const activities = getActivityAnalytics(database, { filters });
  const tasks = getTaskAnalytics(database, { filters });
  const owners = getOwnerPerformance(database, { filters });
  const recentDeals = getRecentDeals(database, 10, { filters });
  const topCustomers = getTopCustomers(database, { filters });

  return { kpis, pipeline, revenue, leads, activities, tasks, owners, recentDeals, topCustomers };
}

export function getDashboardKPIs(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): ReportKpiCard[] {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "d.owner_id = ?" : "";
  const sourceClause = filters.sourceId ? "s.id = ?" : "";
  const pipelineClause = filters.pipeline ? "s.pipeline = ?" : "";
  const dateClause = buildDateClause(filters.dateRange);
  const dateClauseActivities = buildDateClause(filters.dateRange, "a.occurred_at");
  const dateClauseTasks = buildDateClause(filters.dateRange, "t.created_at");

  const kpiParams: unknown[] = [];
  if (ownerClause) kpiParams.push(filters.ownerId);
  if (sourceClause) kpiParams.push(filters.sourceId);
  if (pipelineClause) kpiParams.push(filters.pipeline);
  kpiParams.push(...dateClause.params);
  kpiParams.push(...dateClauseActivities.params);
  kpiParams.push(...dateClauseTasks.params);

  const totalCustomers = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.customers} WHERE deleted_at IS NULL${dateClause.clause.replace(/^ AND /, "")}`
    )
    .get(...dateClause.params) as { count: number };
  const totalLeads = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.leads} l LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL${buildClause(filters.ownerId ? "l.owner_id = ?" : null)}${buildClause(filters.sourceId ? "l.primary_source_id = ?" : null)}${buildClause(filters.pipeline ? "ps.pipeline = ?" : null)}${dateClause.clause}`
    )
    .get(...(filters.ownerId ? [filters.ownerId] : []), ...(filters.sourceId ? [filters.sourceId] : []), ...(filters.pipeline ? [filters.pipeline] : []), ...dateClause.params) as { count: number };
  const openDeals = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND (s.is_terminal = 0 OR s.is_terminal IS NULL)${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}`
    )
    .get(...kpiParams) as { count: number };
  const wonDeals = database
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}`
    )
    .get(...kpiParams) as { count: number; total: number };
  const lostDeals = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost'${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}`
    )
    .get(...kpiParams) as { count: number };
  const totalRevenue = wonDeals.total;
  const totalDeals = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}`
    )
    .get(...kpiParams) as { count: number };
  const wonDealsCount = wonDeals.count;
  const avgDealValue = wonDealsCount > 0 ? totalRevenue / wonDealsCount : 0;
  const conversionRate = totalLeads.count > 0 ? (wonDealsCount > 0 ? (wonDealsCount / totalLeads.count) * 100 : 0) : 0;
  const openTasks = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.tasks} WHERE completed_at IS NULL${dateClauseTasks.clause}`
    )
    .get(...dateClauseTasks.params) as { count: number };
  const completedTasks = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.tasks} WHERE completed_at IS NOT NULL${dateClauseTasks.clause}`
    )
    .get(...dateClauseTasks.params) as { count: number };
  const activitiesThisMonth = dateClauseActivities.clause
    ? database.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.activities} a WHERE 1=1${dateClauseActivities.clause}`).get(...dateClauseActivities.params) as { count: number }
    : database.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.activities} a WHERE strftime('%Y-%m', a.occurred_at) = strftime('%Y-%m', 'now')`).get() as { count: number };

  return [
    { key: "customers", label: "Total Customers", value: totalCustomers.count },
    { key: "leads", label: "Total Leads", value: totalLeads.count },
    { key: "deals", label: "Total Deals", value: totalDeals.count },
    { key: "open_deals", label: "Open Deals", value: openDeals.count },
    { key: "won_deals", label: "Won Deals", value: wonDeals.count },
    { key: "lost_deals", label: "Lost Deals", value: lostDeals.count },
    { key: "revenue", label: "Total Revenue", value: totalRevenue / MINOR },
    { key: "avg_deal", label: "Average Deal Value", value: avgDealValue / MINOR },
    { key: "conversion", label: "Lead Conversion Rate", value: Number(conversionRate.toFixed(1)), format: "percent" as const },
    { key: "open_tasks", label: "Open Tasks", value: openTasks.count },
    { key: "completed_tasks", label: "Completed Tasks", value: completedTasks.count },
    { key: "activities_month", label: "Activities This Month", value: activitiesThisMonth.count },
  ];
}

export function getPipelineAnalytics(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): {
  byStage: PipelineStageAnalytics[];
  funnel: PipelineFunnel[];
  winLoss: WinLossAnalytics;
} {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "d.owner_id = ?" : "";
  const sourceClause = filters.sourceId ? "s.id = ?" : "";
  const pipelineClause = filters.pipeline ? "ps.pipeline = ?" : "";

  const params: unknown[] = [];
  if (ownerClause) params.push(filters.ownerId);
  if (sourceClause) params.push(filters.sourceId);
  if (pipelineClause) params.push(filters.pipeline);

  const byStage = database
    .prepare(
      `SELECT
        ps.id AS stageId,
        ps.label AS stageLabel,
        ps.color AS stageColor,
        COUNT(d.id) AS dealCount,
        COALESCE(SUM(d.expected_value_minor), 0) AS totalValueMinor,
        ps.pipeline AS pipeline
      FROM ${TABLES.stages} ps
      LEFT JOIN ${TABLES.deals} d
        ON d.stage_id = ps.id
        AND d.deleted_at IS NULL
      WHERE (ps.is_archived IS NULL OR ps.is_archived = 0)
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}
      GROUP BY ps.id
      ORDER BY ps.pipeline ASC, ps.sort_order ASC`
    )
    .all(...params) as PipelineStageAnalytics[];

  const totalOpen = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND (s.is_terminal = 0 OR s.is_terminal IS NULL)${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}`
    )
    .all(...params) as { count: number }[];

  const totalOpenCount = totalOpen.length > 0 ? totalOpen[0].count : 0;

  const funnel = byStage.map((stage) => ({
    stageId: stage.stageId,
    stageLabel: stage.stageLabel,
    stageColor: stage.stageColor,
    count: stage.dealCount,
    conversionRate: totalOpenCount > 0 ? Number(((stage.dealCount / totalOpenCount) * 100).toFixed(1)) : 0,
  }));

  const winLoss = (() => {
    const won = database
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}`
      )
      .all(...params) as { count: number; total: number }[];
    const lost = database
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost'${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}`
      )
      .all(...params) as { count: number; total: number }[];
    const open = database
      .prepare(
        `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND (s.is_terminal = 0 OR s.is_terminal IS NULL)${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}`
      )
      .all(...params) as { count: number }[];

    return {
      won: won.length > 0 ? won[0].count : 0,
      lost: lost.length > 0 ? lost[0].count : 0,
      open: open.length > 0 ? open[0].count : 0,
      totalValueMinor: (won.length > 0 ? won[0].total : 0) + (lost.length > 0 ? lost[0].total : 0),
      wonValueMinor: won.length > 0 ? won[0].total : 0,
      lostValueMinor: lost.length > 0 ? lost[0].total : 0,
    } as WinLossAnalytics;
  })();

  return { byStage, funnel, winLoss };
}

export function getRevenueAnalytics(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): {
  byMonth: RevenueByMonth[];
  averageDealSize: AverageDealSize[];
  dealsByMonth: DealsByMonth[];
} {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "d.owner_id = ?" : "";
  const sourceClause = filters.sourceId ? "s.id = ?" : "";
  const pipelineClause = filters.pipeline ? "s.pipeline = ?" : "";
  const dateClause = buildDateClause(filters.dateRange);

  const params: unknown[] = [];
  if (ownerClause) params.push(filters.ownerId);
  if (sourceClause) params.push(filters.sourceId);
  if (pipelineClause) params.push(filters.pipeline);
  params.push(...dateClause.params);

  const byMonth = database
    .prepare(
      `SELECT
        strftime('%Y-%m', d.created_at) AS month,
        COALESCE(SUM(d.won_value_minor), 0) AS revenue,
        COUNT(d.id) AS deals
      FROM ${TABLES.deals} d
      LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
      WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY strftime('%Y-%m', d.created_at)
      ORDER BY month ASC`
    )
    .all(...params) as RevenueByMonth[];

  const createdClosedByMonth = database
    .prepare(
      `SELECT
        strftime('%Y-%m', d.created_at) AS month,
        COUNT(CASE WHEN d.actual_close_date IS NOT NULL THEN 1 END) AS closed,
        COUNT(d.id) AS created
      FROM ${TABLES.deals} d
      WHERE d.deleted_at IS NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY strftime('%Y-%m', d.created_at)
      ORDER BY month ASC`
    )
    .all(...params) as (DealsByMonth & { month: string })[];

  const averageDealSize = database
    .prepare(
      `SELECT
        strftime('%Y-%m', d.actual_close_date) AS month,
        COALESCE(AVG(d.won_value_minor), 0) AS average
      FROM ${TABLES.deals} d
      LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
      WHERE d.deleted_at IS NULL AND s.terminal_type = 'won' AND d.actual_close_date IS NOT NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY strftime('%Y-%m', d.actual_close_date)
      ORDER BY month ASC`
    )
    .all(...params) as AverageDealSize[];

  const dealsByMonth: DealsByMonth[] = createdClosedByMonth.map((row) => ({
    month: row.month,
    created: row.created,
    closed: row.closed,
  }));

  return {
    byMonth,
    averageDealSize,
    dealsByMonth,
  };
}

export function getLeadAnalytics(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): {
  bySource: LeadBySource[];
  byStage: LeadByStage[];
  conversionFunnel: LeadConversionFunnel[];
  topSources: TopSource[];
} {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "l.owner_id = ?" : "";
  const sourceClause = filters.sourceId ? "l.primary_source_id = ?" : "";
  const pipelineClause = filters.pipeline ? "ps.pipeline = ?" : "";
  const dateClause = buildDateClause(filters.dateRange);

  const params: unknown[] = [];
  if (ownerClause) params.push(filters.ownerId);
  if (sourceClause) params.push(filters.sourceId);
  if (pipelineClause) params.push(filters.pipeline);
  params.push(...dateClause.params);

  const bySource = database
    .prepare(
      `SELECT
        s.id AS sourceId,
        s.label AS sourceLabel,
        s.color AS sourceColor,
        COUNT(l.id) AS count
      FROM ${TABLES.leads} l
      LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
      WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY s.id
      ORDER BY count DESC`
    )
    .all(...params) as LeadBySource[];

  const byStage = database
    .prepare(
      `SELECT
        ps.id AS stageId,
        ps.label AS stageLabel,
        ps.color AS stageColor,
        COUNT(l.id) AS count
      FROM ${TABLES.leads} l
      LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
      WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY ps.id
      ORDER BY count DESC`
    )
    .all(...params) as LeadByStage[];

  const totalLeads = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}`
    )
    .get(...params) as { count: number };

  const conversionFunnel = byStage.map((stage) => ({
    stageId: stage.stageId,
    stageLabel: stage.stageLabel,
    stageColor: stage.stageColor,
    count: stage.count,
    conversionRate: totalLeads.count > 0 ? Number(((stage.count / totalLeads.count) * 100).toFixed(1)) : 0,
  }));

  const topSources = database
    .prepare(
      `SELECT
        s.id AS sourceId,
        s.label AS sourceLabel,
        s.color AS sourceColor,
        COUNT(l.id) AS leads,
        COUNT(CASE WHEN d.id IS NOT NULL THEN 1 END) AS deals,
        CASE
          WHEN COUNT(l.id) > 0 THEN ROUND((CAST(COUNT(CASE WHEN d.id IS NOT NULL THEN 1 END) AS FLOAT) / COUNT(l.id)) * 100, 1)
          ELSE 0
        END AS conversionRate
      FROM ${TABLES.leads} l
      LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
      LEFT JOIN ${TABLES.deals} d ON d.lead_id = l.id AND d.deleted_at IS NULL
      WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      GROUP BY s.id
      ORDER BY leads DESC
      LIMIT 10`
    )
    .all(...params) as TopSource[];

  return { bySource, byStage, conversionFunnel, topSources };
}

export function getActivityAnalytics(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): {
  byType: ActivityByType[];
  byUser: ActivityByUser[];
  byMonth: ActivityByMonth[];
} {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "a.user_id = ?" : "";
  const dateClause = buildDateClause(filters.dateRange, "a.occurred_at");

  const params: unknown[] = [];
  if (ownerClause) params.push(filters.ownerId);
  params.push(...dateClause.params);

  const byType = database
    .prepare(
      `SELECT
        at.id AS activityTypeId,
        at.label AS activityTypeLabel,
        at.color AS activityTypeColor,
        COUNT(a.id) AS count,
        COALESCE(SUM(a.duration_seconds), 0) AS duration
      FROM ${TABLES.activities} a
      LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
      WHERE 1=1
      ${buildClause(ownerClause)}${dateClause.clause}
      GROUP BY at.id
      ORDER BY count DESC`
    )
    .all(...params) as ActivityByType[];

  const byUser = database
    .prepare(
      `SELECT
        u.id AS userId,
        u.name AS userName,
        COUNT(a.id) AS count,
        COALESCE(SUM(a.duration_seconds), 0) AS duration
      FROM ${TABLES.activities} a
      LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
      WHERE 1=1
      ${buildClause(ownerClause)}${dateClause.clause}
      GROUP BY u.id
      ORDER BY count DESC
      LIMIT 20`
    )
    .all(...params) as ActivityByUser[];

  const byMonth = database
    .prepare(
      `SELECT
        strftime('%Y-%m', a.occurred_at) AS month,
        COUNT(a.id) AS count,
        COALESCE(SUM(a.duration_seconds), 0) AS duration
      FROM ${TABLES.activities} a
      WHERE 1=1
      ${buildClause(ownerClause)}${dateClause.clause}
      GROUP BY strftime('%Y-%m', a.occurred_at)
      ORDER BY month ASC`
    )
    .all(...params) as ActivityByMonth[];

  return { byType, byUser, byMonth };
}

export function getTaskAnalytics(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): {
  byStatus: TaskByStatus[];
  byType: TaskByType[];
  byUser: TaskByUser[];
  overdue: OverdueTask[];
} {
  const { filters } = context;
  const params: unknown[] = [];

  const ownerClause = filters.ownerId ? "t.assignee_id = ?" : "";
  if (filters.ownerId) params.push(filters.ownerId);

  const dateClause = buildDateClause(filters.dateRange, "t.created_at");

  const openTasks = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.tasks} WHERE completed_at IS NULL${buildClause(ownerClause)}${dateClause.clause}`
    )
    .get(...params, ...dateClause.params) as { count: number };
  const completedTasks = database
    .prepare(
      `SELECT COUNT(*) AS count FROM ${TABLES.tasks} WHERE completed_at IS NOT NULL${buildClause(ownerClause)}${dateClause.clause}`
    )
    .get(...params, ...dateClause.params) as { count: number };

  const byStatus = [
    { status: "open" as const, count: openTasks.count },
    { status: "completed" as const, count: completedTasks.count },
  ];

  const byType = database
    .prepare(
      `SELECT
        tt.id AS taskTypeId,
        tt.label AS taskTypeLabel,
        tt.color AS taskTypeColor,
        COUNT(t.id) AS count,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) AS completed
      FROM ${TABLES.tasks} t
      LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
      WHERE 1=1
      ${buildClause(ownerClause)}${dateClause.clause}
      GROUP BY tt.id
      ORDER BY count DESC`
    )
    .all(...params, ...dateClause.params) as TaskByType[];

  const byUser = database
    .prepare(
      `SELECT
        u.id AS userId,
        u.name AS userName,
        COUNT(CASE WHEN t.completed_at IS NULL THEN 1 END) AS open,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) AS completed,
        COUNT(t.id) AS total
      FROM ${TABLES.tasks} t
      LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
      WHERE 1=1
      ${buildClause(ownerClause)}${dateClause.clause}
      GROUP BY u.id
      ORDER BY total DESC
      LIMIT 20`
    )
    .all(...params, ...dateClause.params) as TaskByUser[];

  const overdue = database
    .prepare(
      `SELECT
        t.id,
        t.title,
        t.due_at,
        u.name AS assigneeName,
        CAST((julianday('now') - julianday(t.due_at)) AS INTEGER) AS daysOverdue
      FROM ${TABLES.tasks} t
      LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
      WHERE t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now')
      ${buildClause(ownerClause)}${dateClause.clause}
      ORDER BY t.due_at ASC
      LIMIT 50`
    )
    .all(...params, ...dateClause.params) as OverdueTask[];

  return { byStatus, byType, byUser, overdue };
}

export function getOwnerPerformance(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): OwnerPerformance[] {
  const { filters } = context;
  const params: unknown[] = [];

  const ownerClause = filters.ownerId ? "u.id = ?" : "";
  if (filters.ownerId) params.push(filters.ownerId);

  const dateClauseDeals = buildDateClause(filters.dateRange, "d2.created_at");
  const dateClauseActivities = buildDateClause(filters.dateRange, "a2.occurred_at");
  const dateClauseTasks = buildDateClause(filters.dateRange, "t2.created_at");

  const rows = database
    .prepare(
      `SELECT
        u.id AS ownerId,
        u.name AS ownerName,
        COALESCE((
          SELECT COUNT(DISTINCT d2.id)
          FROM ${TABLES.deals} d2
          LEFT JOIN ${TABLES.stages} ps2 ON ps2.id = d2.stage_id
          WHERE d2.owner_id = u.id AND d2.deleted_at IS NULL
          ${dateClauseDeals.clause}
        ), 0) AS deals,
        COALESCE((
          SELECT SUM(d3.won_value_minor)
          FROM ${TABLES.deals} d3
          LEFT JOIN ${TABLES.stages} ps3 ON ps3.id = d3.stage_id
          WHERE d3.owner_id = u.id AND d3.deleted_at IS NULL AND ps3.terminal_type = 'won'
          ${dateClauseDeals.clause}
        ), 0) AS revenue,
        COALESCE((
          SELECT COUNT(DISTINCT d4.id)
          FROM ${TABLES.deals} d4
          LEFT JOIN ${TABLES.stages} ps4 ON ps4.id = d4.stage_id
          WHERE d4.owner_id = u.id AND d4.deleted_at IS NULL AND ps4.terminal_type = 'won'
          ${dateClauseDeals.clause}
        ), 0) AS wonDeals,
        COALESCE((SELECT COUNT(DISTINCT a2.id) FROM ${TABLES.activities} a2 WHERE a2.user_id = u.id${dateClauseActivities.clause}), 0) AS activities,
        COALESCE((SELECT COUNT(DISTINCT t2.id) FROM ${TABLES.tasks} t2 WHERE t2.assignee_id = u.id${dateClauseTasks.clause}), 0) AS tasks,
        CASE
          WHEN COALESCE((SELECT COUNT(DISTINCT l2.id) FROM ${TABLES.leads} l2 WHERE l2.owner_id = u.id AND l2.deleted_at IS NULL AND l2.merged_into_id IS NULL), 0) > 0
          THEN ROUND((CAST(COALESCE((SELECT COUNT(DISTINCT d5.id) FROM ${TABLES.deals} d5 WHERE d5.owner_id = u.id AND d5.deleted_at IS NULL), 0) AS FLOAT) / COALESCE((SELECT COUNT(DISTINCT l3.id) FROM ${TABLES.leads} l3 WHERE l3.owner_id = u.id AND l3.deleted_at IS NULL AND l3.merged_into_id IS NULL), 0)) * 100, 1)
          ELSE 0
        END AS conversionRate
      FROM ${TABLES.users} u
      WHERE (u.is_active = 1 OR u.is_active IS NULL)
      ${buildClause(ownerClause)}
      ORDER BY revenue DESC
      LIMIT 20`
    )
    .all(...params, ...dateClauseDeals.params, ...dateClauseActivities.params, ...dateClauseTasks.params) as OwnerPerformance[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.ownerId, r])).values()
  );

  return uniqueRows;
}

export function getRecentDeals(
  database: ReturnType<typeof db>,
  limit: number,
  context: {
    filters: ReportFilters;
  }
): RecentDeal[] {
  const { filters } = context;

  const ownerClause = filters.ownerId ? "d.owner_id = ?" : "";
  const sourceClause = filters.sourceId ? "s.id = ?" : "";
  const pipelineClause = filters.pipeline ? "s.pipeline = ?" : "";
  const dateClause = buildDateClause(filters.dateRange);

  const recentDealsParams: unknown[] = [];
  if (ownerClause) recentDealsParams.push(filters.ownerId);
  if (sourceClause) recentDealsParams.push(filters.sourceId);
  if (pipelineClause) recentDealsParams.push(filters.pipeline);
  recentDealsParams.push(...dateClause.params);
  recentDealsParams.push(limit);

  const rows = database
    .prepare(
      `SELECT
        d.id,
        d.name,
        e.name AS customer_name,
        s.label AS stage_label,
        s.color AS stage_color,
        d.expected_value_minor,
        d.currency_code,
        u.name AS owner_name,
        d.created_at
      FROM ${TABLES.deals} d
      LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
      LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
      LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
      WHERE d.deleted_at IS NULL
      ${buildClause(ownerClause)}${buildClause(sourceClause)}${buildClause(pipelineClause)}${dateClause.clause}
      ORDER BY d.created_at DESC
      LIMIT ?`
    )
    .all(...recentDealsParams) as RecentDeal[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows;
}

export function getTopCustomers(
  database: ReturnType<typeof db>,
  context: {
    filters: ReportFilters;
  }
): TopCustomer[] {
  const { filters } = context;

  const dateClause = buildDateClause(filters.dateRange);
  const dateOnClause = dateClause.clause.replace(/^ AND /, "");

  const ownerCondition = filters.ownerId ? "d.owner_id = ?" : null;
  const sourceCondition = filters.sourceId ? "src.id = ?" : null;
  const pipelineCondition = filters.pipeline ? "s.pipeline = ?" : null;

  const topCustomersParams: unknown[] = [];
  if (ownerCondition) topCustomersParams.push(filters.ownerId);
  if (sourceCondition) topCustomersParams.push(filters.sourceId);
  if (pipelineCondition) topCustomersParams.push(filters.pipeline);
  topCustomersParams.push(...dateClause.params);

  return database
    .prepare(
      `SELECT
        e.id,
        e.name,
        COUNT(DISTINCT d.id) AS dealCount,
        COALESCE(SUM(d.won_value_minor), 0) AS totalRevenue,
        COUNT(DISTINCT a.id) AS activitiesCount,
        COUNT(DISTINCT t.id) AS tasksCount
      FROM ${TABLES.customers} e
      LEFT JOIN ${TABLES.deals} d ON d.establishment_id = e.id AND d.deleted_at IS NULL${dateOnClause ? ` AND ${dateOnClause}` : ""}
      LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
      LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id
      LEFT JOIN ${TABLES.sources} src ON src.id = l.primary_source_id
      LEFT JOIN ${TABLES.activities} a ON a.entity_type = 'establishment' AND a.entity_id = e.id
      LEFT JOIN ${TABLES.tasks} t ON t.entity_type = 'establishment' AND t.entity_id = e.id
      WHERE e.deleted_at IS NULL
      ${buildClause(ownerCondition)}${buildClause(sourceCondition)}${buildClause(pipelineCondition)}
      GROUP BY e.id
      ORDER BY totalRevenue DESC
      LIMIT 10`
    )
    .all(...topCustomersParams) as TopCustomer[];
}

export function getReportFilterOptions() {
  const database = db();

  const owners = database
    .prepare(`SELECT id, name FROM ${TABLES.users} WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC`)
    .all() as { id: string; name: string }[];
  const uniqueOwners = Array.from(
    new Map(owners.map((o) => [o.id, o])).values()
  );

  const pipelines = database
    .prepare(`SELECT DISTINCT pipeline FROM ${TABLES.stages} WHERE pipeline IS NOT NULL AND (is_archived IS NULL OR is_archived = 0) ORDER BY pipeline ASC`)
    .all() as { pipeline: string }[];

  const sources = database
    .prepare(`SELECT id, label, color FROM ${TABLES.sources} WHERE is_archived IS NULL OR is_archived = 0 ORDER BY sort_order ASC`)
    .all() as { id: string; label: string; color: string | null }[];

  return {
    owners: uniqueOwners,
    pipelines: pipelines.map((p) => p.pipeline),
    sources,
  };
}

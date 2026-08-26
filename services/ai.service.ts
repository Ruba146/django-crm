import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { analyzeGlobal } from "@/services/ai-analysis.service";
import { getDailyBriefing, detectLossPatterns, detectConversionPatterns, detectStageBottlenecks } from "@/services/ai-priority.service";
import type {
  AiCalculatedMetrics,
  AiData,
  AiInactiveCustomer,
  AiInsight,
  AiOverviewCard,
  AiOwnerSummary,
  AiRecommendation,
  AiRiskDeal,
} from "@/types";

function db() {
  return getDb();
}

/* ------------------------------------------------------------------ */
/* Raw aggregates                                                      */
/* ------------------------------------------------------------------ */

interface RawCounts {
  customers: number;
  leads: number;
  deals: number;
  activities: number;
  tasks: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenueMinor: number;
  openTasks: number;
  overdueTaskCount: number;
  lostThisMonth: number;
  lostLastMonth: number;
  wonThisMonth: number;
  wonLastMonth: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  dealsThisMonth: number;
  dealsLastMonth: number;
  totalDealsEver: number;
  totalLeadsEver: number;
}

function getRawCounts(): RawCounts {
  const database = db();
  const row = database
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM ${TABLES.customers} WHERE deleted_at IS NULL) AS customers,
        (SELECT COUNT(*) FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL) AS leads,
        (SELECT COUNT(*) FROM ${TABLES.deals} WHERE deleted_at IS NULL) AS deals,
        (SELECT COUNT(*) FROM ${TABLES.activities}) AS activities,
        (SELECT COUNT(*) FROM ${TABLES.tasks}) AS tasks,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND (s.is_terminal = 0 OR s.is_terminal IS NULL)) AS openDeals,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won') AS wonDeals,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost') AS lostDeals,
        (SELECT COALESCE(SUM(d.won_value_minor), 0) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won') AS totalRevenueMinor,
        (SELECT COUNT(*) FROM ${TABLES.tasks} WHERE completed_at IS NULL) AS openTasks,
        (SELECT COUNT(*) FROM ${TABLES.tasks} WHERE completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')) AS overdueTaskCount,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost' AND strftime('%Y-%m', d.created_at) = strftime('%Y-%m', 'now')) AS lostThisMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost' AND strftime('%Y-%m', d.created_at) = strftime('%Y-%m', date('now', '-1 month'))) AS lostLastMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won' AND strftime('%Y-%m', d.created_at) = strftime('%Y-%m', 'now')) AS wonThisMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won' AND strftime('%Y-%m', d.created_at) = strftime('%Y-%m', date('now', '-1 month'))) AS wonLastMonth,
        (SELECT COUNT(*) FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')) AS leadsThisMonth,
        (SELECT COUNT(*) FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL AND strftime('%Y-%m', created_at) = strftime('%Y-%m', date('now', '-1 month'))) AS leadsLastMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} WHERE deleted_at IS NULL AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')) AS dealsThisMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} WHERE deleted_at IS NULL AND strftime('%Y-%m', created_at) = strftime('%Y-%m', date('now', '-1 month'))) AS dealsLastMonth,
        (SELECT COUNT(*) FROM ${TABLES.deals} WHERE deleted_at IS NULL) AS totalDealsEver,
        (SELECT COUNT(*) FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL) AS totalLeadsEver
      `
    )
    .get() as RawCounts & {
      customers: number;
      leads: number;
      deals: number;
      activities: number;
      tasks: number;
      openDeals: number;
      wonDeals: number;
      lostDeals: number;
      totalRevenueMinor: number;
      openTasks: number;
      overdueTaskCount: number;
      lostThisMonth: number;
      lostLastMonth: number;
      wonThisMonth: number;
      wonLastMonth: number;
      leadsThisMonth: number;
      leadsLastMonth: number;
      dealsThisMonth: number;
      dealsLastMonth: number;
      totalDealsEver: number;
      totalLeadsEver: number;
    };

  return {
    customers: Number(row.customers ?? 0),
    leads: Number(row.leads ?? 0),
    deals: Number(row.deals ?? 0),
    activities: Number(row.activities ?? 0),
    tasks: Number(row.tasks ?? 0),
    openDeals: Number(row.openDeals ?? 0),
    wonDeals: Number(row.wonDeals ?? 0),
    lostDeals: Number(row.lostDeals ?? 0),
    totalRevenueMinor: Number(row.totalRevenueMinor ?? 0),
    openTasks: Number(row.openTasks ?? 0),
    overdueTaskCount: Number(row.overdueTaskCount ?? 0),
    lostThisMonth: Number(row.lostThisMonth ?? 0),
    lostLastMonth: Number(row.lostLastMonth ?? 0),
    wonThisMonth: Number(row.wonThisMonth ?? 0),
    wonLastMonth: Number(row.wonLastMonth ?? 0),
    leadsThisMonth: Number(row.leadsThisMonth ?? 0),
    leadsLastMonth: Number(row.leadsLastMonth ?? 0),
    dealsThisMonth: Number(row.dealsThisMonth ?? 0),
    dealsLastMonth: Number(row.dealsLastMonth ?? 0),
    totalDealsEver: Number(row.totalDealsEver ?? 0),
    totalLeadsEver: Number(row.totalLeadsEver ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Overview cards                                                      */
/* ------------------------------------------------------------------ */

export function getAiOverviewCards(): AiOverviewCard[] {
  const counts = getRawCounts();
  return [
    { key: "customers", label: "Total Customers", value: counts.customers, icon: "Users" },
    { key: "leads", label: "Total Leads", value: counts.leads, icon: "UserPlus" },
    { key: "deals", label: "Total Deals", value: counts.deals, icon: "Handshake" },
    { key: "activities", label: "Activities", value: counts.activities, icon: "Activity" },
    { key: "tasks", label: "Open Tasks", value: counts.openTasks, icon: "CheckSquare" },
    { key: "revenue", label: "Revenue (SAR)", value: Math.round(counts.totalRevenueMinor / 100), icon: "DollarSign" },
    { key: "conversion", label: "Conversion Rate", value: Number(((counts.totalDealsEver / counts.totalLeadsEver) * 100).toFixed(1)), format: "percent" as const, icon: "Target" },
    { key: "win_rate", label: "Win Rate", value: Number(((counts.wonDeals / counts.totalDealsEver) * 100).toFixed(1)), format: "percent" as const, icon: "TrendingUp" },
  ];
}

/* ------------------------------------------------------------------ */
/* Calculated metrics                                                   */
/* ------------------------------------------------------------------ */

export function getAiCalculatedMetrics(): AiCalculatedMetrics {
  const counts = getRawCounts();
  const leadConversionRate = counts.totalLeadsEver > 0 ? Number(((counts.totalDealsEver / counts.totalLeadsEver) * 100).toFixed(1)) : 0;
  const avgDealValue = counts.totalDealsEver > 0 ? Math.round(counts.totalRevenueMinor / counts.totalDealsEver) : 0;
  const winRate = counts.totalDealsEver > 0 ? Number(((counts.wonDeals / counts.totalDealsEver) * 100).toFixed(1)) : 0;

  const inactiveCustomers = countInactiveCustomers();
  const dealsNoRecentActivity = countDealsNoRecentActivity();

  return {
    leadConversionRate,
    averageDealValue: avgDealValue,
    winRate,
    overdueTaskCount: counts.overdueTaskCount,
    inactiveCustomers,
    dealsWithNoRecentActivity: dealsNoRecentActivity,
    openDeals: counts.openDeals,
    wonDeals: counts.wonDeals,
    lostDeals: counts.lostDeals,
    totalRevenueMinor: counts.totalRevenueMinor,
    openTasks: counts.openTasks,
    leads: counts.leads,
  };
}

function countInactiveCustomers(): number {
  const database = db();
  const row = database
    .prepare(
      `WITH establishment_activities AS (
         SELECT e.id AS establishment_id, MAX(a.occurred_at) AS last_activity
         FROM ${TABLES.customers} e
         LEFT JOIN ${TABLES.activities} a ON a.entity_type = 'establishment' AND a.entity_id = e.id
         GROUP BY e.id
       ),
       deal_activities AS (
         SELECT d.establishment_id, MAX(a.occurred_at) AS last_activity
         FROM ${TABLES.deals} d
         JOIN ${TABLES.activities} a ON a.entity_type = 'deal' AND a.entity_id = d.id
         WHERE d.deleted_at IS NULL
         GROUP BY d.establishment_id
       ),
       lead_activities AS (
         SELECT l.establishment_id, MAX(a.occurred_at) AS last_activity
         FROM ${TABLES.leads} l
         JOIN ${TABLES.activities} a ON a.entity_type = 'lead' AND a.entity_id = l.id
         WHERE l.deleted_at IS NULL
         GROUP BY l.establishment_id
       ),
       combined AS (
         SELECT establishment_id, MAX(last_activity) AS last_activity
         FROM (
           SELECT * FROM establishment_activities
           UNION ALL
           SELECT * FROM deal_activities
           UNION ALL
           SELECT * FROM lead_activities
         )
         GROUP BY establishment_id
       )
       SELECT COUNT(*) AS count
       FROM ${TABLES.customers} e
       LEFT JOIN combined c ON c.establishment_id = e.id
       WHERE e.deleted_at IS NULL
         AND (c.last_activity IS NULL OR c.last_activity < date('now', '-30 days'))`
    )
    .get() as { count: number };
  return Number(row?.count ?? 0);
}

function countDealsNoRecentActivity(): number {
  const database = db();
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM ${TABLES.deals} d
       WHERE d.deleted_at IS NULL
         AND (d.updated_at IS NULL OR d.updated_at < date('now', '-14 days'))
         AND (
           SELECT COUNT(*) FROM ${TABLES.activities} a
           WHERE a.entity_type = 'deal' AND a.entity_id = d.id AND a.occurred_at >= date('now', '-14 days')
         ) = 0`
    )
    .get() as { count: number };
  return Number(row?.count ?? 0);
}

/* ------------------------------------------------------------------ */
/* Risk deals                                                          */
/* ------------------------------------------------------------------ */

interface RiskDealRow {
  id: string;
  name: string | null;
  customer_name: string | null;
  stage_label: string | null;
  stage_color: string | null;
  expected_value_minor: number | null;
  currency_code: string | null;
  owner_name: string | null;
  days_since_update: number;
  probability_pct: number | null;
}

export function getRiskDeals(limit = 10): AiRiskDeal[] {
  const database = db();
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
        CAST((julianday('now') - julianday(COALESCE(d.updated_at, d.created_at))) AS INTEGER) AS days_since_update,
        d.probability_pct
      FROM ${TABLES.deals} d
      LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
      LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
      LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
      WHERE d.deleted_at IS NULL
        AND (s.is_terminal IS NULL OR s.is_terminal = 0)
        AND (
          d.updated_at IS NULL OR d.updated_at < date('now', '-14 days')
          OR d.probability_pct IS NULL OR d.probability_pct < 20
        )
      ORDER BY days_since_update DESC
      LIMIT ?`
    )
    .all(limit) as RiskDealRow[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows.map((r) => ({
    id: r.id,
    name: r.name,
    customerName: r.customer_name,
    stageLabel: r.stage_label,
    stageColor: r.stage_color,
    expectedValueMinor: r.expected_value_minor,
    currencyCode: r.currency_code,
    ownerName: r.owner_name,
    daysSinceUpdate: Number(r.days_since_update ?? 0),
    probabilityPct: r.probability_pct,
  }));
}

/* ------------------------------------------------------------------ */
/* Inactive customers                                                  */
/* ------------------------------------------------------------------ */

interface InactiveCustomerRow {
  id: string;
  name: string | null;
  city: string | null;
  last_activity_at: string | null;
  days_since_activity: number;
  deal_count: number;
  owner_name: string | null;
}

export function getInactiveCustomers(limit = 10): AiInactiveCustomer[] {
  const database = db();
  const rows = database
    .prepare(
      `SELECT
        e.id,
        e.name,
        e.city,
        MAX(a.occurred_at) AS last_activity_at,
        CAST(julianday('now') - julianday(MAX(a.occurred_at)) AS INTEGER) AS days_since_activity,
        COUNT(DISTINCT d.id) AS deal_count,
        u.name AS owner_name
      FROM ${TABLES.customers} e
      LEFT JOIN ${TABLES.leads} l ON l.establishment_id = e.id AND l.deleted_at IS NULL
      LEFT JOIN ${TABLES.deals} d ON d.establishment_id = e.id AND d.deleted_at IS NULL
      LEFT JOIN ${TABLES.activities} a ON (
        (a.entity_type = 'establishment' AND a.entity_id = e.id)
        OR (a.entity_type = 'lead' AND a.entity_id = l.id)
        OR (a.entity_type = 'deal' AND a.entity_id = d.id)
      )
      LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
      WHERE e.deleted_at IS NULL
      GROUP BY e.id
      HAVING last_activity_at IS NULL OR days_since_activity > 30
      ORDER BY days_since_activity DESC
      LIMIT ?`
    )
    .all(limit) as InactiveCustomerRow[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.id, r])).values()
  );

  return uniqueRows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    lastActivityAt: r.last_activity_at,
    daysSinceActivity: Number(r.days_since_activity ?? 0),
    dealCount: Number(r.deal_count ?? 0),
    ownerName: r.owner_name,
  }));
}

/* ------------------------------------------------------------------ */
/* Owner summaries                                                     */
/* ------------------------------------------------------------------ */

interface OwnerSummaryRow {
  ownerId: string;
  ownerName: string;
  wonDeals: number;
  totalDeals: number;
  conversionRate: number;
  overdueTasks: number;
  totalTasks: number;
}

export function getOwnerSummaries(): AiOwnerSummary[] {
  const database = db();
  const rows = database
    .prepare(
      `SELECT
        u.id AS ownerId,
        u.name AS ownerName,
        COALESCE(won.wonDeals, 0) AS wonDeals,
        COALESCE(all_deals.totalDeals, 0) AS totalDeals,
        COALESCE(conv.conversionRate, 0) AS conversionRate,
        COALESCE(ot.overdueTasks, 0) AS overdueTasks,
        COALESCE(tasks.totalTasks, 0) AS totalTasks
      FROM ${TABLES.users} u
      LEFT JOIN (
        SELECT owner_id, COUNT(*) AS wonDeals
        FROM ${TABLES.deals} d
        LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id
        WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'
        GROUP BY owner_id
      ) won ON won.owner_id = u.id
      LEFT JOIN (
        SELECT owner_id, COUNT(*) AS totalDeals
        FROM ${TABLES.deals}
        WHERE deleted_at IS NULL
        GROUP BY owner_id
      ) all_deals ON all_deals.owner_id = u.id
      LEFT JOIN (
        SELECT l.owner_id,
          CASE
            WHEN COALESCE((SELECT COUNT(*) FROM ${TABLES.leads} l2 WHERE l2.owner_id = l.owner_id AND l2.deleted_at IS NULL AND l2.merged_into_id IS NULL), 0) > 0
            THEN ROUND((CAST(COALESCE((SELECT COUNT(*) FROM ${TABLES.deals} d2 WHERE d2.owner_id = l.owner_id AND d2.deleted_at IS NULL), 0) AS FLOAT) / COALESCE((SELECT COUNT(*) FROM ${TABLES.leads} l3 WHERE l3.owner_id = l.owner_id AND l3.deleted_at IS NULL AND l3.merged_into_id IS NULL), 0)) * 100, 1)
            ELSE 0
          END AS conversionRate
        FROM ${TABLES.leads} l
        WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL AND l.owner_id IS NOT NULL
        GROUP BY l.owner_id
      ) conv ON conv.owner_id = u.id
      LEFT JOIN (
        SELECT assignee_id, COUNT(*) AS overdueTasks
        FROM ${TABLES.tasks}
        WHERE completed_at IS NULL AND due_at IS NOT NULL AND date(due_at) < date('now')
        GROUP BY assignee_id
      ) ot ON ot.assignee_id = u.id
      LEFT JOIN (
        SELECT assignee_id, COUNT(*) AS totalTasks
        FROM ${TABLES.tasks}
        GROUP BY assignee_id
      ) tasks ON tasks.assignee_id = u.id
      WHERE u.is_active = 1 OR u.is_active IS NULL
      ORDER BY wonDeals DESC
      LIMIT 20`
    )
    .all() as OwnerSummaryRow[];

  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.ownerId, r])).values()
  );

  return uniqueRows.map((r) => ({
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    wonDeals: Number(r.wonDeals ?? 0),
    totalDeals: Number(r.totalDeals ?? 0),
    conversionRate: Number(r.conversionRate ?? 0),
    overdueTasks: Number(r.overdueTasks ?? 0),
    totalTasks: Number(r.totalTasks ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* AI Insights (rule-based, dynamic)                                   */
/* ------------------------------------------------------------------ */

export function getAiInsights(metrics: AiCalculatedMetrics, owners: AiOwnerSummary[]): AiInsight[] {
  const insights: AiInsight[] = [];

  if (metrics.lostDeals > 0 && metrics.lostDeals >= metrics.wonDeals) {
    insights.push({
      id: "insight-lost-deals",
      severity: "warning",
      title: "High number of lost deals",
      description: `You have ${metrics.lostDeals} lost deals compared to ${metrics.wonDeals} won deals. Review your qualification process and pricing strategy.`,
    });
  }

  if (metrics.dealsWithNoRecentActivity > 0) {
    insights.push({
      id: "insight-stale-deals",
      severity: "warning",
      title: "Deals stalled without recent activity",
      description: `${metrics.dealsWithNoRecentActivity} deals have not been updated for over 14 days. Follow up to keep momentum.`,
    });
  }

  const conversionDropThreshold = 20;
  if (metrics.leadConversionRate < conversionDropThreshold && metrics.leadConversionRate > 0) {
    insights.push({
      id: "insight-conversion-drop",
      severity: "critical",
      title: "Low lead conversion rate",
      description: `Conversion rate is ${metrics.leadConversionRate}%, which is below the 20% threshold. Review lead quality and nurturing workflows.`,
    });
  }

  if (owners.length > 0) {
    const topOwner = owners[0];
    insights.push({
      id: "insight-top-owner",
      severity: "info",
      title: `Top performer: ${topOwner.ownerName || "Unknown"}`,
      description: `${topOwner.ownerName || "Unknown"} has ${topOwner.wonDeals} won deals with a ${topOwner.conversionRate}% conversion rate. Consider sharing their approach with the team.`,
    });

    const overloaded = owners.find((o) => o.overdueTasks >= 5);
    if (overloaded) {
      insights.push({
        id: "insight-overloaded-owner",
        severity: "warning",
        title: `${overloaded.ownerName || "Unknown"} has the most overdue tasks`,
        description: `${overloaded.ownerName || "Unknown"} has ${overloaded.overdueTasks} overdue tasks. Consider redistributing workload.`,
      });
    }
  }

  if (metrics.overdueTaskCount > 0) {
    insights.push({
      id: "insight-overdue-tasks",
      severity: "critical",
      title: "Overdue tasks detected",
      description: `${metrics.overdueTaskCount} tasks are past their due date. Prioritize completion to avoid SLA breaches.`,
    });
  }

  if (metrics.inactiveCustomers > 0) {
    insights.push({
      id: "insight-inactive-customers",
      severity: "info",
      title: "Inactive customers detected",
      description: `${metrics.inactiveCustomers} customers have had no activity in over 30 days. Re-engagement campaigns may help.`,
    });
  }

  if (metrics.openDeals > 5) {
    insights.push({
      id: "insight-open-deals",
      severity: "info",
      title: "Multiple deals in pipeline",
      description: `There are ${metrics.openDeals} open deals worth attention. Prioritize high-value opportunities.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "insight-healthy",
      severity: "info",
      title: "Pipeline looks healthy",
      description: "No critical issues detected. Keep monitoring key metrics.",
    });
  }

  return insights;
}

/* ------------------------------------------------------------------ */
/* AI Recommendations (dynamic)                                        */
/* ------------------------------------------------------------------ */

export function getAiRecommendations(
  metrics: AiCalculatedMetrics,
  owners: AiOwnerSummary[],
  inactiveCustomers: AiInactiveCustomer[]
): AiRecommendation[] {
  const recommendations: AiRecommendation[] = [];

  if (metrics.overdueTaskCount > 0) {
    recommendations.push({
      id: "rec-overdue-tasks",
      priority: "high",
      title: "Complete overdue tasks",
      description: `${metrics.overdueTaskCount} tasks are overdue. Assign and complete them to stay on track.`,
      actionLabel: "View tasks",
    });
  }

  if (inactiveCustomers.length > 0) {
    recommendations.push({
      id: "rec-inactive-customers",
      priority: "high",
      title: "Re-engage inactive customers",
      description: `${inactiveCustomers.length} customers have had no recent activity. Schedule follow-ups or re-engagement campaigns.`,
      actionLabel: "View customers",
    });
  }

  if (metrics.leadConversionRate < 20 && metrics.leads > 0) {
    recommendations.push({
      id: "rec-improve-conversion",
      priority: "high",
      title: "Improve lead conversion rate",
      description: `Conversion rate is ${metrics.leadConversionRate}%. Review lead sources and qualification criteria to improve quality.`,
      actionLabel: "Review leads",
    });
  }

  const overloaded = owners.find((o) => o.overdueTasks >= 3);
  if (overloaded) {
    recommendations.push({
      id: "rec-reassign",
      priority: "medium",
      title: "Reassign overloaded owners",
      description: `${overloaded.ownerName || "Unknown"} has ${overloaded.overdueTasks} overdue tasks. Consider reassigning some work to balance the load.`,
      actionLabel: "View owners",
    });
  }

  recommendations.push({
    id: "rec-follow-up-leads",
    priority: "medium",
    title: "Follow up with inactive leads",
    description: "Review leads that have not been contacted recently and schedule follow-up activities.",
    actionLabel: "View leads",
  });

  recommendations.push({
    id: "rec-high-value-deals",
    priority: "medium",
    title: "Prioritize high-value open deals",
    description: "Focus on open deals with the highest expected value to maximize revenue this quarter.",
    actionLabel: "View deals",
  });

  recommendations.push({
    id: "rec-no-activity-deals",
    priority: "low",
    title: "Review stalled deals",
    description: `${metrics.dealsWithNoRecentActivity} deals have no recent activity. Determine if they need follow-up or should be closed.`,
    actionLabel: "View deals",
  });

  if (recommendations.length === 0) {
    recommendations.push({
      id: "rec-healthy",
      priority: "low",
      title: "Continue current momentum",
      description: "No immediate actions required. Keep monitoring key metrics and nurturing your pipeline.",
      actionLabel: "View dashboard",
    });
  }

  return recommendations;
}

/* ------------------------------------------------------------------ */
/* Executive Summary (dynamic)                                          */
/* ------------------------------------------------------------------ */

export function getExecutiveSummary(metrics: AiCalculatedMetrics, owners: AiOwnerSummary[]): string {
  const parts: string[] = [];

  const revenue = (metrics.totalRevenueMinor / 100).toFixed(0);
  const conversion = metrics.leadConversionRate.toFixed(1);

  parts.push(`Total revenue is ${revenue} SAR with a lead conversion rate of ${conversion}%.`);

  const dealTrend: string[] = [];
  if (metrics.openDeals > 0) dealTrend.push(`${metrics.openDeals} open deals`);
  if (metrics.wonDeals > 0) dealTrend.push(`${metrics.wonDeals} won deals`);
  if (metrics.lostDeals > 0) dealTrend.push(`${metrics.lostDeals} lost deals`);
  if (dealTrend.length > 0) {
    parts.push(`Currently ${dealTrend.join(", ")}.`);
  }

  if (owners.length > 0) {
    const top = owners[0];
    parts.push(`${top.ownerName || "Unknown"} has the highest close rate at ${top.conversionRate}% with ${top.wonDeals} won deals.`);
  }

  if (metrics.overdueTaskCount > 0) {
    parts.push(`${metrics.overdueTaskCount} tasks are overdue and need attention.`);
  }

  if (metrics.inactiveCustomers > 0) {
    parts.push(`${metrics.inactiveCustomers} customers are inactive and may need re-engagement.`);
  }

  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Main payload                                                         */
/* ------------------------------------------------------------------ */

export function getAiData(): AiData {
  const metrics = getAiCalculatedMetrics();
  const owners = getOwnerSummaries();
  const insights = getAiInsights(metrics, owners);
  const recommendations = getAiRecommendations(metrics, owners, []);
  const inactiveCustomers = getInactiveCustomers(10);
  const riskDeals = getRiskDeals(10);
  const executiveSummary = getExecutiveSummary(metrics, owners);
  const globalAnalysis = analyzeGlobal();
  const dailyBriefing = getDailyBriefing();
  const lossPatterns = detectLossPatterns();
  const conversionPatterns = detectConversionPatterns();
  const stageBottlenecks = detectStageBottlenecks();

  return {
    overview: {
      totals: {
        customers: getRawCounts().customers,
        leads: getRawCounts().leads,
        deals: getRawCounts().deals,
        activities: getRawCounts().activities,
        tasks: getRawCounts().tasks,
      },
      metrics,
    },
    insights,
    recommendations,
    executiveSummary,
    riskDeals,
    inactiveCustomers,
    topOwners: owners.slice(0, 5),
    globalAnalysis,
    dailyBriefing,
    lossPatterns,
    conversionPatterns,
    stageBottlenecks,
  };
}

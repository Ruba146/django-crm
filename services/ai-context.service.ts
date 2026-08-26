import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { getDashboardStats } from "@/services/dashboard.service";
import { getCustomerDetail, getCustomerStatistics, getCustomerActivities, getCustomerTasks } from "@/services/customer.service";
import { getLeadDetail, getLeadActivities, getLeadTasks, getLeadDeals } from "@/services/lead.service";
import { getDealDetail, getDealActivities, getDealTasks } from "@/services/deal.service";
import {
  getAiCalculatedMetrics,
  getAiInsights,
  getAiRecommendations,
  getExecutiveSummary,
  getOwnerSummaries,
} from "@/services/ai.service";
import {
  analyzeCustomer,
  analyzeLead,
  analyzeDeal,
  analyzeTask,
  analyzeGlobal,
} from "@/services/ai-analysis.service";
import { detectLossPatterns, detectConversionPatterns, detectStageBottlenecks } from "@/services/ai-priority.service";
import type { CRMContextData, PageContext } from "@/types/ai-chat";

/* ------------------------------------------------------------------ */
/* Arabic / text normalization                                         */
/* ------------------------------------------------------------------ */

const AR_STOP_WORDS = new Set([
  "في","من","إلى","على","عن","مع","هذا","هذه","ذلك","تلك",
  "الذي","التي","الذين","اللواتي","و","أو","ثم","قد","كان","كانت",
  "هل","ما","ماذا","لماذا","كيف","متى","أين","كم","لدي","عند",
  "لكن","إذا","بعد","قبل","خلال","بين","هو","هي","هم","هن",
  "أن","إن","يكون","تكون","صفر","واحد","اثنان","اثنين","ثلاثة",
  "أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","عندي",
  "عندك","عنده","عندها","عندنا","عندكم","عندهم","أبو","ابو",
  "بن","ال","الى","اي","ما","من","لم","لن","لا","لكن","لخص",
  "عند","بغا","ابغى","أبغى","أبي","ابي","عاوز","عاوزة","نبي","نبيها",
  "يش","تس","ير","سل"," Shay","esh","tcs","ly","eno","eno",
]);

const EN_STOP_WORDS = new Set([
  "the","is","a","an","in","on","at","to","for","of","and","or",
  "but","not","with","by","from","as","are","was","were","be","been",
  "being","have","has","had","do","does","did","will","would","could",
  "should","may","might","must","shall","can","need","what","which",
  "who","when","where","why","how","all","each","every","both","few",
  "more","most","other","some","such","no","nor","only","own","same",
  "so","than","too","very","just","because","if","while","about",
  "up","out","off","over","under","again","further","then","once",
  "here","there","this","that","these","those","it","its","he","she",
  "they","them","his","her","their","my","your","our","their",
  "want","please","can","could","would","should","do","does","did",
  "summarize","tell","me","show","give","get","find","search","look",
]);

export function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .trim()
    .toLowerCase();
}

function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function extractSearchTerms(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  const candidates = words.filter((w) => {
    const lower = w.toLowerCase();
    return !AR_STOP_WORDS.has(w) && !EN_STOP_WORDS.has(lower);
  });

  const bigrams: string[] = [];
  for (let i = 0; i < candidates.length - 1; i++) {
    if (candidates[i].length + candidates[i + 1].length >= 5) {
      bigrams.push(candidates[i] + " " + candidates[i + 1]);
    }
  }

  return [...new Set([...candidates, ...bigrams])];
}

/* ------------------------------------------------------------------ */
/* Entity search                                                       */
/* ------------------------------------------------------------------ */

export interface EntitySearchResult {
  id: string;
  type: "customer" | "lead" | "deal" | "owner" | "task" | "activity";
  name: string;
  relevance: number;
  details: Record<string, unknown>;
}

export interface EntitySearchResults {
  customers: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; fullName: string; company: string | null }>;
  deals: Array<{ id: string; name: string; company: string | null; stage: string | null }>;
  owners: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; title: string; assigneeName: string | null }>;
  activities: Array<{ id: string; body: string; occurredAt: string }>;
}

function safeAll<T>(query: () => T[]): T[] {
  try { return query(); } catch { return []; }
}

function safeGet<T>(query: () => T, fallback: T): T {
  try { return query(); } catch { return fallback; }
}

export function searchCRMRecords(query: string): EntitySearchResults {
  const db = getDb();
  const terms = extractSearchTerms(query);

  type Candidate = { id: string; name: string; type: string; relevance: number; details: Record<string, unknown> };
  const allCandidates: Candidate[] = [];

  for (const term of terms) {
    const normalized = normalizeArabic(term);
    const likeTerm = `%${escapeLike(normalized)}%`;

    const customerRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT id, name FROM ${TABLES.customers} WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' LIMIT 20`
          )
          .all(likeTerm) as { id: string; name: string }[]
    );
    for (const row of customerRows) {
      const score = calcRelevance(row.name, normalized);
      if (score > 0) allCandidates.push({ id: row.id, name: row.name, type: "customer", relevance: score, details: { name: row.name } });
    }

    const leadRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT l.id, l.full_name AS fullName, e.name AS company FROM ${TABLES.leads} l LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL AND (l.full_name LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\') LIMIT 20`
          )
          .all(likeTerm, likeTerm) as { id: string; fullName: string; company: string | null }[]
    );
    for (const row of leadRows) {
      const nameScore = calcRelevance(row.fullName, normalized);
      const companyScore = row.company ? calcRelevance(row.company, normalized) : 0;
      const score = Math.max(nameScore, companyScore);
      if (score > 0) allCandidates.push({ id: row.id, name: row.fullName, type: "lead", relevance: score, details: { fullName: row.fullName, company: row.company } });
    }

    const dealRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT d.id, d.name, e.name AS company, ps.label AS stage FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id WHERE d.deleted_at IS NULL AND (d.name LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\') LIMIT 20`
          )
          .all(likeTerm, likeTerm) as { id: string; name: string; company: string | null; stage: string | null }[]
    );
    for (const row of dealRows) {
      const nameScore = calcRelevance(row.name, normalized);
      const companyScore = row.company ? calcRelevance(row.company, normalized) : 0;
      const score = Math.max(nameScore, companyScore);
      if (score > 0) allCandidates.push({ id: row.id, name: row.name, type: "deal", relevance: score, details: { name: row.name, company: row.company, stage: row.stage } });
    }

    const ownerRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT DISTINCT u.id, u.name FROM ${TABLES.users} u WHERE u.name LIKE ? ESCAPE '\\' LIMIT 20`
          )
          .all(likeTerm) as { id: string; name: string }[]
    );
    for (const row of ownerRows) {
      const score = calcRelevance(row.name, normalized);
      if (score > 0) allCandidates.push({ id: row.id, name: row.name, type: "owner", relevance: score, details: { name: row.name } });
    }

    const taskRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT t.id, t.title, u.name AS assigneeName FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.title LIKE ? ESCAPE '\\' LIMIT 20`
          )
          .all(likeTerm) as { id: string; title: string; assigneeName: string | null }[]
    );
    for (const row of taskRows) {
      const score = calcRelevance(row.title, normalized);
      if (score > 0) allCandidates.push({ id: row.id, name: row.title, type: "task", relevance: score, details: { title: row.title, assigneeName: row.assigneeName } });
    }

    const activityRows = safeAll(
      () =>
        db
          .prepare(
            `SELECT a.id, a.body, a.occurred_at AS occurredAt FROM ${TABLES.activities} a WHERE a.body LIKE ? ESCAPE '\\' LIMIT 20`
          )
          .all(likeTerm) as { id: string; body: string; occurredAt: string }[]
    );
    for (const row of activityRows) {
      const score = calcRelevance(row.body, normalized);
      if (score > 0) allCandidates.push({ id: row.id, name: row.body.slice(0, 40), type: "activity", relevance: score, details: { body: row.body, occurredAt: row.occurredAt } });
    }
  }

  allCandidates.sort((a, b) => b.relevance - a.relevance);

  const seen = new Set<string>();
  const customers: EntitySearchResults["customers"] = [];
  const leads: EntitySearchResults["leads"] = [];
  const deals: EntitySearchResults["deals"] = [];
  const owners: EntitySearchResults["owners"] = [];
  const tasks: EntitySearchResults["tasks"] = [];
  const activities: EntitySearchResults["activities"] = [];

  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    switch (c.type) {
      case "customer":
        customers.push({ id: c.id, name: c.name });
        break;
      case "lead":
        leads.push({ id: c.id, fullName: c.details.fullName as string, company: c.details.company as string | null });
        break;
      case "deal":
        deals.push({ id: c.id, name: c.name, company: c.details.company as string | null, stage: c.details.stage as string | null });
        break;
      case "owner":
        owners.push({ id: c.id, name: c.name });
        break;
      case "task":
        tasks.push({ id: c.id, title: c.name, assigneeName: c.details.assigneeName as string | null });
        break;
      case "activity":
        activities.push({ id: c.id, body: c.details.body as string, occurredAt: c.details.occurredAt as string });
        break;
    }
    if (customers.length + leads.length + deals.length + owners.length + tasks.length + activities.length >= 15) break;
  }

  return {
    customers: customers.slice(0, 5),
    leads: leads.slice(0, 5),
    deals: deals.slice(0, 5),
    owners: owners.slice(0, 5),
    tasks: tasks.slice(0, 5),
    activities: activities.slice(0, 5),
  };
}

function calcRelevance(name: string | null, normalizedQuery: string): number {
  if (!name) return 0;
  const normalizedName = normalizeArabic(name);
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery)) return 80;
  if (normalizedName.includes(normalizedQuery)) return 60;
  if (normalizedQuery.includes(normalizedName) && normalizedName.length >= 3) return 40;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Targeted retrieval helpers                                           */
/* ------------------------------------------------------------------ */

export function getCustomerSummary(id: string) {
  const detail = getCustomerDetail(id);
  const statistics = getCustomerStatistics(id);
  const activities = getCustomerActivities(id, 10);
  const tasks = getCustomerTasks(id, 10);
  if (!detail) return null;

  return {
    id: detail.id,
    name: detail.name ?? "",
    city: detail.city ?? "",
    industry: detail.industry?.label ?? null,
    source: detail.source?.label ?? null,
    status: detail.status?.label ?? null,
    ownerName: detail.ownerName,
    notes: detail.notes,
    totalDeals: statistics?.dealsCount ?? 0,
    totalTasks: statistics?.tasksCount ?? 0,
    openDeals: statistics?.openDeals ?? 0,
    wonDeals: statistics?.wonDeals ?? 0,
    lostDeals: statistics?.lostDeals ?? 0,
    totalRevenueMinor: statistics?.totalRevenueMinor ?? 0,
    currencyCode: statistics?.currency_code ?? "SAR",
    lastActivity: activities[0]?.occurred_at ?? undefined,
    activitiesTimeline: activities.slice(0, 5).map((a) => ({
      id: a.id ?? "",
      type: a.activity_type_label ?? "Activity",
      body: a.body ?? "",
      direction: a.direction ?? "",
      occurredAt: a.occurred_at ?? "",
      userName: a.user_name ?? "",
    })),
    tasksTimeline: tasks.slice(0, 5).map((t) => ({
      id: t.id ?? "",
      title: t.title ?? "",
      dueAt: t.due_at ?? "",
      completedAt: t.completed_at ?? "",
      assigneeName: t.assignee_name ?? "",
      mode: t.mode ?? "",
    })),
  };
}

export function getLeadSummary(id: string) {
  const detail = getLeadDetail(id);
  const activities = getLeadActivities(id, 10);
  const tasks = getLeadTasks(id, 10);
  const deals = getLeadDeals(id);
  if (!detail) return null;

  return {
    id: detail.id,
    fullName: detail.full_name ?? "",
    company: detail.company,
    phone: detail.phone,
    email: detail.email,
    stage: detail.stage?.label ?? null,
    source: detail.source?.label ?? null,
    ownerName: detail.ownerName,
    probabilityPct: detail.probability_pct,
    notes: detail.notes,
    created_at: detail.created_at,
    dealsCount: deals.length,
    openDeals: deals.filter((d) => !d.status).length,
    wonDeals: deals.filter((d) => d.status === "won").length,
    lostDeals: deals.filter((d) => d.status === "lost").length,
    totalRevenueMinor: deals.reduce((sum, d) => sum + (d.expected_value_minor ?? 0), 0),
    activitiesTimeline: activities.slice(0, 5).map((a) => ({
      id: a.id ?? "",
      type: a.activity_type_label ?? "Activity",
      body: a.body ?? "",
      direction: a.direction ?? "",
      occurredAt: a.occurred_at ?? "",
      userName: a.user_name ?? "",
    })),
    tasksTimeline: tasks.slice(0, 5).map((t) => ({
      id: t.id ?? "",
      title: t.title ?? "",
      dueAt: t.due_at ?? "",
      completedAt: t.completed_at ?? "",
      assigneeName: t.assignee_name ?? "",
      mode: t.mode ?? "",
    })),
  };
}

export function getDealSummary(id: string) {
  const detail = getDealDetail(id);
  const activities = getDealActivities(id, 10);
  const tasks = getDealTasks(id, 10);
  if (!detail) return null;

  return {
    id: detail.id,
    name: detail.name ?? "",
    company: detail.company,
    leadName: detail.leadName,
    stage: detail.stage?.label ?? null,
    ownerName: detail.ownerName,
    expectedValueMinor: detail.expected_value_minor,
    wonValueMinor: detail.won_value_minor,
    probabilityPct: detail.probability_pct,
    targetCloseDate: detail.target_close_date ?? null,
    status: detail.status ?? null,
    notes: detail.notes,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    latestActivities: activities.slice(0, 5).map((a) => ({
      id: a.id ?? "",
      type: a.activity_type_label ?? "Activity",
      body: a.body ?? "",
      direction: a.direction ?? "",
      occurredAt: a.occurred_at ?? "",
      userName: a.user_name ?? "",
    })),
    activitiesTimeline: activities.slice(0, 5).map((a) => ({
      id: a.id ?? "",
      type: a.activity_type_label ?? "Activity",
      body: a.body ?? "",
      direction: a.direction ?? "",
      occurredAt: a.occurred_at ?? "",
      userName: a.user_name ?? "",
    })),
    tasksTimeline: tasks.slice(0, 5).map((t) => ({
      id: t.id ?? "",
      title: t.title ?? "",
      dueAt: t.due_at ?? "",
      completedAt: t.completed_at ?? "",
      assigneeName: t.assignee_name ?? "",
      mode: t.mode ?? "",
    })),
  };
}

export function getDealStatistics() {
  const db = getDb();
  const openRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND (s.is_terminal IS NULL OR s.is_terminal = 0)`
        )
        .get() as { count: number },
    { count: 0 }
  );
  const wonRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'`
        )
        .get() as { count: number },
    { count: 0 }
  );
  const lostRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'lost'`
        )
        .get() as { count: number },
    { count: 0 }
  );
  const revenueRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'`
        )
        .get() as { total: number },
    { total: 0 }
  );

  const stages = safeAll(
    () =>
      db
        .prepare(
          `SELECT ps.label, ps.color, COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id WHERE d.deleted_at IS NULL GROUP BY ps.label ORDER BY ps.sort_order ASC`
        )
        .all() as { label: string | null; color: string | null; count: number }[]
  );

  return {
    open: Number(openRow.count ?? 0),
    won: Number(wonRow.count ?? 0),
    lost: Number(lostRow.count ?? 0),
    totalRevenueMinor: Number(revenueRow.total ?? 0),
    stages: stages.filter((s) => s.label != null),
  };
}

export function getOverdueTasksSummary() {
  const db = getDb();
  const overdue = safeAll(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.due_at, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now') ORDER BY t.due_at ASC LIMIT 10`
        )
        .all() as { id: string; title: string | null; due_at: string | null; assignee_name: string | null }[]
  );

  return overdue.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    dueAt: r.due_at ?? "",
    assigneeName: r.assignee_name ?? "",
  }));
}

export function getOwnerPerformanceSummary() {
  const owners = getOwnerSummaries();
  return owners.slice(0, 10).map((o) => ({
    id: o.ownerId,
    name: o.ownerName,
    wonDeals: o.wonDeals,
    totalDeals: o.totalDeals,
    conversionRate: o.conversionRate,
    overdueTasks: o.overdueTasks,
    totalTasks: o.totalTasks,
  }));
}

/* ------------------------------------------------------------------ */
/* Dashboard KPIs                                                      */
/* ------------------------------------------------------------------ */

interface DashboardKpis {
  revenue: number;
  conversionRate: number;
  winRate: number;
}

function getDashboardKpis(): DashboardKpis {
  const db = getDb();

  const revenueRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'`
        )
        .get() as { total: number },
    { total: 0 }
  );

  const totalDealsEver = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS count FROM ${TABLES.deals} WHERE deleted_at IS NULL`)
        .get() as { count: number },
    { count: 0 }
  );

  const wonDealsRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'`
        )
        .get() as { count: number },
    { count: 0 }
  );

  const totalLeadsEver = safeGet(
    () =>
      db
        .prepare(`SELECT COUNT(*) AS count FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL`)
        .get() as { count: number },
    { count: 0 }
  );

  const totalDeals = Number(totalDealsEver.count ?? 0);
  const wonDeals = Number(wonDealsRow.count ?? 0);
  const totalLeads = Number(totalLeadsEver.count ?? 0);

  const conversionRate = totalLeads > 0 ? Number(((totalDeals / totalLeads) * 100).toFixed(1)) : 0;
  const winRate = totalDeals > 0 ? Number(((wonDeals / totalDeals) * 100).toFixed(1)) : 0;

  return {
    revenue: Number(revenueRow.total ?? 0),
    conversionRate,
    winRate,
  };
}

/* ------------------------------------------------------------------ */
/* Task summary                                                        */
/* ------------------------------------------------------------------ */

interface TaskSummary {
  overdue: Array<{ id: string; title: string; dueAt: string; assigneeName: string }>;
  upcoming: Array<{ id: string; title: string; dueAt: string; assigneeName: string }>;
  completed: Array<{ id: string; title: string; completedAt: string; assigneeName: string }>;
  byOwner: Record<string, { overdue: number; upcoming: number; completed: number }>;
}

function getTaskSummary(): TaskSummary {
  const db = getDb();

  const overdueRaw = safeAll(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.due_at, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) < date('now') ORDER BY t.due_at ASC LIMIT 10`
        )
        .all() as { id: string; title: string | null; due_at: string | null; assignee_name: string | null }[]
  );

  const upcomingRaw = safeAll(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.due_at, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.completed_at IS NULL AND t.due_at IS NOT NULL AND date(t.due_at) >= date('now') ORDER BY t.due_at ASC LIMIT 10`
        )
        .all() as { id: string; title: string | null; due_at: string | null; assignee_name: string | null }[]
  );

  const completedRaw = safeAll(
    () =>
      db
        .prepare(
          `SELECT t.id, t.title, t.completed_at, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.completed_at IS NOT NULL ORDER BY t.completed_at DESC LIMIT 10`
        )
        .all() as { id: string; title: string | null; completed_at: string | null; assignee_name: string | null }[]
  );

  const ownerRows = safeAll(
    () =>
      db
        .prepare(
          `SELECT u.name AS owner_name, t.completed_at, t.due_at FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE u.name IS NOT NULL`
        )
        .all() as { owner_name: string; completed_at: string | null; due_at: string | null }[]
  );

  const byOwner: TaskSummary["byOwner"] = {};
  for (const row of ownerRows) {
    if (!byOwner[row.owner_name]) {
      byOwner[row.owner_name] = { overdue: 0, upcoming: 0, completed: 0 };
    }
    if (row.completed_at) {
      byOwner[row.owner_name].completed++;
    } else if (row.due_at && new Date(row.due_at) < new Date()) {
      byOwner[row.owner_name].overdue++;
    } else {
      byOwner[row.owner_name].upcoming++;
    }
  }

  return {
    overdue: overdueRaw.map((r) => ({ id: r.id, title: r.title ?? "", dueAt: r.due_at ?? "", assigneeName: r.assignee_name ?? "" })),
    upcoming: upcomingRaw.map((r) => ({ id: r.id, title: r.title ?? "", dueAt: r.due_at ?? "", assigneeName: r.assignee_name ?? "" })),
    completed: completedRaw.map((r) => ({ id: r.id, title: r.title ?? "", completedAt: r.completed_at ?? "", assigneeName: r.assignee_name ?? "" })),
    byOwner,
  };
}

/* ------------------------------------------------------------------ */
/* Activities summary                                                  */
/* ------------------------------------------------------------------ */

interface ActivitiesSummary {
  latest: CRMContextData["recentActivities"];
  timeline: Array<{
    id: string;
    kind: string;
    body: string;
    direction: string;
    occurredAt: string;
    userName: string;
    label: string;
  }>;
  communicationHistory: CRMContextData["recentActivities"];
}

function getActivitiesSummary(): ActivitiesSummary {
  const db = getDb();

  const latest = getRecentActivities(10).map((a) => ({
    id: a.id ?? "",
    type: a.activity_type_label ?? "Activity",
    body: a.body ?? "",
    direction: a.direction ?? "",
    occurredAt: a.occurred_at ?? "",
    userName: a.user_name ?? "",
  }));

  const rawTimeline = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.id, a.body, a.direction, a.occurred_at, u.name AS user_name, at.label AS label FROM ${TABLES.activities} a LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id LEFT JOIN ${TABLES.users} u ON u.id = a.user_id ORDER BY a.occurred_at DESC LIMIT 20`
        )
        .all() as { id: string; body: string | null; direction: string | null; occurred_at: string | null; user_name: string | null; label: string | null }[]
  );

  const timeline = rawTimeline.map((r) => ({
    id: r.id,
    kind: "activity",
    body: r.body ?? "",
    direction: r.direction ?? "",
    occurredAt: r.occurred_at ?? "",
    userName: r.user_name ?? "",
    label: r.label ?? "Activity",
  }));

  const communicationHistory = safeAll(
    () =>
      db
        .prepare(
          `SELECT a.id, at.label AS type, a.body, a.direction, a.occurred_at, u.name AS user_name FROM ${TABLES.activities} a LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id LEFT JOIN ${TABLES.users} u ON u.id = a.user_id WHERE a.direction IS NOT NULL AND a.direction != '' ORDER BY a.occurred_at DESC LIMIT 10`
        )
        .all() as { id: string; label: string | null; body: string | null; direction: string | null; occurred_at: string | null; user_name: string | null }[]
  );

  return {
    latest,
    timeline,
    communicationHistory: communicationHistory.map((r) => ({
      id: r.id,
      type: r.label ?? "Activity",
      body: r.body ?? "",
      direction: r.direction ?? "",
      occurredAt: r.occurred_at ?? "",
      userName: r.user_name ?? "",
    })),
  };
}

function getRecentActivities(limit: number) {
  const db = getDb();
  return safeAll(
    () =>
      db
        .prepare(
          `SELECT a.id, at.label AS activity_type_label, a.direction, a.body, u.name AS user_name, a.occurred_at FROM ${TABLES.activities} a LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id LEFT JOIN ${TABLES.users} u ON u.id = a.user_id ORDER BY a.occurred_at DESC LIMIT ?`
        )
        .all(limit) as Array<{
          id: string | null;
          activity_type_label: string | null;
          direction: string | null;
          body: string | null;
          user_name: string | null;
          occurred_at: string | null;
        }>
  );
}

/* ------------------------------------------------------------------ */
/* AI Workspace data                                                   */
/* ------------------------------------------------------------------ */

interface AiWorkspaceData {
  calculatedMetrics?: NonNullable<CRMContextData["aiWorkspace"]>["calculatedMetrics"];
  recommendations?: NonNullable<CRMContextData["aiWorkspace"]>["recommendations"];
  executiveSummary?: string;
  insights?: NonNullable<CRMContextData["aiWorkspace"]>["insights"];
  lossPatterns?: NonNullable<CRMContextData["aiWorkspace"]>["lossPatterns"];
  conversionPatterns?: NonNullable<CRMContextData["aiWorkspace"]>["conversionPatterns"];
  stageBottlenecks?: NonNullable<CRMContextData["aiWorkspace"]>["stageBottlenecks"];
}

function getAiWorkspaceData(): AiWorkspaceData {
  try {
    const metrics = getAiCalculatedMetrics();
    const owners = getOwnerSummaries();
    const insights = getAiInsights(metrics, owners);
    const recommendations = getAiRecommendations(metrics, owners, []);
    const executiveSummary = getExecutiveSummary(metrics, owners);
    const lossPatterns = detectLossPatterns();
    const conversionPatterns = detectConversionPatterns();
    const stageBottlenecks = detectStageBottlenecks();

    return {
      calculatedMetrics: {
        leadConversionRate: metrics.leadConversionRate,
        averageDealValue: metrics.averageDealValue,
        winRate: metrics.winRate,
        overdueTaskCount: metrics.overdueTaskCount,
        inactiveCustomers: metrics.inactiveCustomers,
        dealsWithNoRecentActivity: metrics.dealsWithNoRecentActivity,
        openDeals: metrics.openDeals,
        wonDeals: metrics.wonDeals,
        lostDeals: metrics.lostDeals,
        totalRevenueMinor: metrics.totalRevenueMinor,
        openTasks: metrics.openTasks,
        leads: metrics.leads,
      },
      recommendations: recommendations.map((r) => ({
        id: r.id,
        priority: r.priority,
        title: r.title,
        description: r.description,
        actionLabel: r.actionLabel,
      })),
      executiveSummary,
      insights: insights.map((ins) => ({
        id: ins.id,
        severity: ins.severity,
        title: ins.title,
        description: ins.description,
      })),
      lossPatterns: lossPatterns.map((p) => ({
        id: p.id,
        type: p.type,
        severity: p.severity,
        title: p.title,
        description: p.description,
        evidence: p.evidence,
        sampleSize: p.sampleSize,
        confidence: p.confidence,
        businessImpact: p.businessImpact,
      })),
      conversionPatterns: conversionPatterns.map((p) => ({
        id: p.id,
        type: p.type,
        severity: p.severity,
        title: p.title,
        description: p.description,
        evidence: p.evidence,
        sampleSize: p.sampleSize,
        confidence: p.confidence,
        businessImpact: p.businessImpact,
      })),
      stageBottlenecks: stageBottlenecks.map((b) => ({
        id: b.id,
        stage: b.stage,
        stageColor: b.stageColor,
        totalDeals: b.totalDeals,
        avgDaysInStage: b.avgDaysInStage,
        stalledDeals: b.stalledDeals,
        bottleneckScore: b.bottleneckScore,
        severity: b.severity,
        recommendation: b.recommendation,
      })),
    };
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Conversation memory                                                 */
/* ------------------------------------------------------------------ */

export interface ConversationMemory {
  currentCustomerId?: string;
  currentLeadId?: string;
  currentDealId?: string;
  currentOwnerId?: string;
}

/* ------------------------------------------------------------------ */
/* Record validation                                                   */
/* ------------------------------------------------------------------ */

export function validateRecordContext(context: PageContext): { valid: boolean; error?: string } {
  if (!context.recordId || !context.recordType) {
    return { valid: true };
  }

  const db = getDb();
  const tableMap: Record<string, string> = {
    customer: TABLES.customers,
    lead: TABLES.leads,
    deal: TABLES.deals,
    task: TABLES.tasks,
    activity: TABLES.activities,
  };

  const table = tableMap[context.recordType];
  if (!table) {
    return { valid: false, error: `Unknown record type: ${context.recordType}` };
  }

  try {
    const exists = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(context.recordId) as { id: string } | undefined;
    if (!exists) {
      return { valid: false, error: `${context.recordType} not found: ${context.recordId}` };
    }
  } catch {
    return { valid: false, error: `Failed to validate ${context.recordType}` };
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/* Main context builder                                                */
/* ------------------------------------------------------------------ */

export function getCRMContext(context: PageContext, userMessage?: string): CRMContextData {
  const db = getDb();
  const message = (userMessage || "").toLowerCase();
  const stats = getDashboardStats();
  const kpis = getDashboardKpis();
  const memory = (context.metadata?.conversationMemory as ConversationMemory | undefined) ?? {};

  const totalRevenueRow = safeGet(
    () =>
      db
        .prepare(
          `SELECT COALESCE(SUM(d.won_value_minor), 0) AS total FROM ${TABLES.deals} d LEFT JOIN ${TABLES.stages} s ON s.id = d.stage_id WHERE d.deleted_at IS NULL AND s.terminal_type = 'won'`
        )
        .get() as { total: number },
    { total: 0 }
  );

  const base: CRMContextData = {
    page: context.page,
    recordId: context.recordId,
    recordType: context.recordType,
    recordName: context.recordName,
    recordCompany: context.recordCompany,
    recordStage: context.recordStage,
    recordOwner: context.recordOwner,
    recordStatus: context.recordStatus,
    currentFilters: context.currentFilters,
    route: context.route,
    language: context.metadata?.language as string | undefined,
    metrics: {
      totalCustomers: stats.customers,
      totalLeads: stats.leads,
      totalDeals: stats.deals,
      totalRevenueMinor: toMinor(totalRevenueRow.total),
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      totalActivities: 0,
      totalTasks: 0,
      overdueTasks: 0,
    },
    recentActivities: [],
    dashboardKpis: {
      revenue: kpis.revenue,
      conversionRate: kpis.conversionRate,
      winRate: kpis.winRate,
    },
    conversationMemory: memory,
  };

  const wantsDeals = /صفقة|صفقات|deal|deals|pipeline|بايپلاين/.test(message);
  const wantsTasks = /مهمة|مهام|تاسك|task|tasks|متأخر|overdue/.test(message);
  const wantsActivities = /نشاط|أنشطة|activity|activities/.test(message);
  const wantsPerformance = /موظف|أداء|performance|owner|مالك/.test(message);
  const wantsCounts = /كم عدد|عدد|كdeboss|count|how many/.test(message);
  const wantsAnalysis = /لخص|تحليل|تحليل|summarize|analysis|وضع|حالة/.test(message);

  if (wantsDeals || wantsCounts || wantsAnalysis) {
    const dealStats = getDealStatistics();
    base.metrics.openDeals = dealStats.open;
    base.metrics.wonDeals = dealStats.won;
    base.metrics.lostDeals = dealStats.lost;
    base.metrics.totalRevenueMinor = dealStats.totalRevenueMinor;
    base.dealStatistics = dealStats;
  }

  if (wantsTasks || wantsAnalysis) {
    base.taskSummary = getTaskSummary();
    base.metrics.overdueTasks = base.taskSummary.overdue.length;
    base.metrics.totalTasks =
      base.taskSummary.overdue.length +
      base.taskSummary.upcoming.length +
      base.taskSummary.completed.length;
  }

  if (wantsActivities || wantsAnalysis) {
    base.recentActivities = getRecentActivities(10).map((a) => ({
      id: a.id ?? "",
      type: a.activity_type_label ?? "Activity",
      body: a.body ?? "",
      direction: a.direction ?? "",
      occurredAt: a.occurred_at ?? "",
      userName: a.user_name ?? "",
    }));
    base.activitiesSummary = getActivitiesSummary();
    base.metrics.totalActivities = base.recentActivities.length;
  }

  if (wantsPerformance || wantsAnalysis) {
    base.ownerPerformance = getOwnerPerformanceSummary();
  }

  if (wantsAnalysis && !wantsDeals && !wantsTasks) {
    base.aiWorkspace = getAiWorkspaceData();
  }

  if (context.recordId && context.recordType === "customer") {
    const summary = getCustomerSummary(context.recordId);
    if (summary) {
      base.customer = summary;
      base.recordName = summary.name ?? context.recordId;
      base.recordCompany = summary.name ?? undefined;
      base.recordOwner = summary.ownerName ?? undefined;
      base.recordStatus = summary.status ?? undefined;
    }
  }

  if (context.recordId && context.recordType === "lead") {
    const summary = getLeadSummary(context.recordId);
    if (summary) {
      base.lead = summary;
      base.recordName = summary.fullName ?? context.recordId;
      base.recordCompany = summary.company ?? undefined;
      base.recordStage = summary.stage ?? undefined;
      base.recordOwner = summary.ownerName ?? undefined;
    }
  }

  if (context.recordId && context.recordType === "deal") {
    const summary = getDealSummary(context.recordId);
    if (summary) {
      base.deal = summary;
      base.recordName = summary.name ?? context.recordId;
      base.recordCompany = summary.company ?? undefined;
      base.recordStage = summary.stage ?? undefined;
      base.recordOwner = summary.ownerName ?? undefined;
      base.recordStatus = summary.status ?? undefined;
    }
  }

  if (context.recordId && context.recordType === "task") {
    const tasks = safeGet(
      () =>
        db
          .prepare(`SELECT t.id, t.title, t.assignee_id, u.name AS assignee_name FROM ${TABLES.tasks} t LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id WHERE t.id = ? LIMIT 1`)
          .get(context.recordId) as { id: string; title: string | null; assignee_id: string | null; assignee_name: string | null } | undefined,
      undefined
    );

    if (tasks) {
      base.recordName = tasks.title ?? context.recordId;
      base.recordOwner = tasks.assignee_name ?? undefined;
    }
  }

  if (context.recordId && context.recordType === "activity") {
    const activity = safeGet(
      () =>
        db
          .prepare(`SELECT a.id, a.body, u.name AS user_name FROM ${TABLES.activities} a LEFT JOIN ${TABLES.users} u ON u.id = a.user_id WHERE a.id = ? LIMIT 1`)
          .get(context.recordId) as { id: string; body: string | null; user_name: string | null } | undefined,
      undefined
    );

    if (activity) {
      base.recordName = activity.body?.slice(0, 40) ?? context.recordId;
      base.recordOwner = activity.user_name ?? undefined;
    }
  }

  if (context.recordId && context.recordType === "customer") {
    const analysis = analyzeCustomer(context.recordId);
    if (analysis) base.customerAnalysis = analysis;
  }

  if (context.recordId && context.recordType === "lead") {
    const analysis = analyzeLead(context.recordId);
    if (analysis) base.leadAnalysis = analysis;
  }

  if (context.recordId && context.recordType === "deal") {
    const analysis = analyzeDeal(context.recordId);
    if (analysis) base.dealAnalysis = analysis;
  }

  if (context.recordId && context.recordType === "task") {
    const analysis = analyzeTask(context.recordId);
    if (analysis) base.taskAnalysis = analysis;
  }

  if (context.page === "ai" || context.page === "dashboard") {
    const globalAnalysis = analyzeGlobal();
    base.globalAnalysis = globalAnalysis;
    if (!base.aiWorkspace) {
      base.aiWorkspace = getAiWorkspaceData();
    }
  }

  return base;
}

function toMinor(value: number | null | undefined): number {
  return Number(value ?? 0);
}

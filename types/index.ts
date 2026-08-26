/**
 * Shared domain types for the CRM.
 *
 * These types mirror the SQLite schema and are used across services,
 * hooks and components. They are intentionally generic and framework-free
 * so they can be reused by AI modules and future features.
 */

/** A row from the `users` table. */
export interface User {
  id: string | null;
  email: string | null;
  name: string | null;
  email_verified: string | null;
  image: string | null;
  google_email: string | null;
  roles: string | null;
  locale: string | null;
  is_active: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** A row from the `establishments` table (a customer / company). */
export interface Customer {
  id: string | null;
  name: string | null;
  commercial_registration_number: string | null;
  tax_number: string | null;
  industry_id: string | null;
  city: string | null;
  address: string | null;
  num_branches: number | null;
  has_warehouse: number | null;
  num_pos: number | null;
  current_system: string | null;
  customer_requirements: string | null;
  expected_value_minor: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_ai_copy: number | null;
  ai_source: string | null;
  source_record_id: string | null;
  ai_created_at: string | null;
  ai_action_id: string | null;
}

/** A row from the `leads` table. */
export interface Lead {
  id: string | null;
  full_name: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  stage_id: string | null;
  primary_source_id: string | null;
  establishment_id: string | null;
  owner_id: string | null;
  junk_reason_id: string | null;
  merged_into_id: string | null;
  custom_fields: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_ai_copy: number | null;
  ai_source: string | null;
  source_record_id: string | null;
  ai_created_at: string | null;
  ai_action_id: string | null;
}

/** A row from the `deals` table. */
export interface Deal {
  id: string | null;
  lead_id: string | null;
  establishment_id: string | null;
  stage_id: string | null;
  owner_id: string | null;
  name: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  mrr_minor: number | null;
  contract_length_months: number | null;
  seat_count: number | null;
  probability_pct: number | null;
  target_close_date: string | null;
  actual_close_date: string | null;
  contract_end_date: string | null;
  discount_requested_pct: number | null;
  discount_approved_pct: number | null;
  discount_approved_by_id: string | null;
  discount_status: string | null;
  lost_reason_id: string | null;
  custom_fields: string | null;
  is_ai_copy: number | null;
  ai_source: string | null;
  source_record_id: string | null;
  ai_created_at: string | null;
  ai_action_id: string | null;
}

/** A row from the `tasks` table. */
export interface Task {
  id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  task_type_id: string | null;
  title: string | null;
  description: string | null;
  mode: string | null;
  assignee_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_ai_copy: number | null;
  ai_source: string | null;
  source_record_id: string | null;
  ai_created_at: string | null;
  ai_action_id: string | null;
}

/** A row from the `activities` table. */
export interface Activity {
  id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  activity_type_id: string | null;
  direction: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  body: string | null;
  user_id: string | null;
  occurred_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_ai_copy: number | null;
  ai_source: string | null;
  source_record_id: string | null;
  ai_created_at: string | null;
  ai_action_id: string | null;
}

/** A row from the `pipeline_stages` table. */
export interface PipelineStage {
  id: string | null;
  pipeline: string | null;
  label: string | null;
  color: string | null;
  sort_order: number | null;
  is_terminal: number | null;
  terminal_type: string | null;
}

/** A row from the `sources` table. */
export interface Source {
  id: string | null;
  label: string | null;
  color: string | null;
  sort_order: number | null;
  adapter_key: string | null;
}

/** A row from the `industries` table. */
export interface Industry {
  id: string | null;
  label: string | null;
  color: string | null;
  sort_order: number | null;
}

/** A row from the `contacts` table. */
export interface Contact {
  id: string | null;
  establishment_id: string | null;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Aggregate counters used by the dashboard. */
export interface DashboardStats {
  customers: number;
  leads: number;
  deals: number;
  activities: number;
  tasks: number;
}

/** A single pipeline stage with its live deal count. */
export interface PipelineData {
  id: string | null;
  label: string | null;
  color: string | null;
  pipeline: string | null;
  sort_order: number | null;
  dealCount: number;
  totalValueMinor: number;
}

/** A recent activity row enriched for the dashboard widget. */
export interface RecentActivity {
  id: string | null;
  activity_type_label: string | null;
  activity_type_color: string | null;
  direction: string | null;
  body: string | null;
  entity_type: string | null;
  entity_name: string | null;
  user_name: string | null;
  occurred_at: string | null;
}

/** An upcoming task enriched for the dashboard widget. */
export interface UpcomingTask {
  id: string | null;
  title: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  due_at: string | null;
  assignee_name: string | null;
  mode: string | null;
}

/** A recent deal enriched for the dashboard widget. */
export interface RecentDeal {
  id: string | null;
  name: string | null;
  customer_name: string | null;
  stage_label: string | null;
  stage_color: string | null;
  expected_value_minor: number | null;
  currency_code: string | null;
  owner_name: string | null;
  created_at: string | null;
}

/** A KPI card descriptor. */
export interface KpiCard {
  key: "customers" | "leads" | "deals" | "activities" | "tasks";
  label: string;
  value: number;
  /** Optional trend metadata for future expansion (not yet populated). */
  trendDirection?: "up" | "down" | "flat";
  trendPercentage?: number;
  comparisonLabel?: string;
}

/** A generic paginated result envelope. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------------- */
/* Customers module                                                       */
/* ---------------------------------------------------------------------- */

/** A customer row enriched for the list view (establisments + related data). */
export interface CustomerListItem {
  id: string;
  name: string | null;
  city: string | null;
  commercial_registration_number: string | null;
  created_at: string | null;
  /** Primary contact (from `contacts`). */
  primaryContact: { name: string | null; email: string | null; phone: string | null } | null;
  /** Industry label + color (from `industries`). */
  industry: { label: string | null; color: string | null } | null;
  /** Source label + color (from the associated lead's source). */
  source: { label: string | null; color: string | null } | null;
  /** Status label + color (from the associated lead's stage). */
  status: { label: string | null; color: string | null } | null;
  /** Owner name (from the associated lead's owner). */
  ownerName: string | null;
  /** Industry id (used for filtering). */
  industryId: string | null;
  /** Source id (used for filtering). */
  sourceId: string | null;
  /** Status/stage id (used for filtering). */
  statusId: string | null;
  /** Owner id (used for filtering). */
  ownerId: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Full customer detail for the split-view details panel. */
export interface CustomerDetail {
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
  industry: { label: string | null; color: string | null } | null;
  source: { label: string | null; color: string | null } | null;
  status: { label: string | null; color: string | null } | null;
  ownerName: string | null;
  contacts: Contact[];
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** A customer statistic summary card value. */
export interface CustomerStatistics {
  dealsCount: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  activitiesCount: number;
  tasksCount: number;
  totalRevenueMinor: number;
  currency_code: string | null;
}

/** A customer activity enriched for the timeline (via lead/deal). */
export interface CustomerActivity {
  id: string | null;
  activity_type_label: string | null;
  activity_type_color: string | null;
  direction: string | null;
  body: string | null;
  user_name: string | null;
  occurred_at: string | null;
  entity_type: string | null;
}

/** A customer task enriched for the details panel. */
export interface CustomerTask {
  id: string | null;
  title: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  due_at: string | null;
  completed_at: string | null;
  assignee_name: string | null;
  mode: string | null;
}

/** A customer deal enriched for the details panel. */
export interface CustomerDeal {
  id: string | null;
  name: string | null;
  stage_label: string | null;
  stage_color: string | null;
  expected_value_minor: number | null;
  probability_pct: number | null;
  currency_code: string | null;
  owner_name: string | null;
  status: string | null;
}

/** Filter options for the customer list (industries, sources, owners, statuses). */
export interface CustomerFilterOptions {
  industries: Industry[];
  sources: Source[];
  owners: { id: string; name: string }[];
  statuses: PipelineStage[];
}

/** Paginated customer list result from the server. */
export interface CustomerPageResult {
  records: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------------- */
/* Leads module                                                           */
/* ---------------------------------------------------------------------- */

/** A lead row enriched for the list view (lead + company/source/stage/owner). */
export interface LeadListItem {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  /** Source label + color (from `sources`). */
  source: { label: string | null; color: string | null } | null;
  /** Pipeline stage label + color (from the lead pipeline). */
  stage: { label: string | null; color: string | null } | null;
  ownerName: string | null;
  created_at: string | null;
  /** Latest activity timestamp across the lead and its deals. */
  last_activity_at: string | null;
  /** Terminal stage label for quick status context, when applicable. */
  status: { label: string | null; color: string | null } | null;
  /** Highest probability across the lead's open deals. */
  probability_pct: number | null;
  /** Source id (used for filtering). */
  sourceId: string | null;
  /** Stage id (used for filtering). */
  stageId: string | null;
  /** Owner id (used for filtering). */
  ownerId: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Full lead detail for the split-view details panel. */
export interface LeadDetail {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  companyCity: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: { label: string | null; color: string | null } | null;
  stage: { label: string | null; color: string | null } | null;
  status: { label: string | null; color: string | null } | null;
  ownerName: string | null;
  probability_pct: number | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** A lead activity enriched for the timeline. */
export interface LeadActivity {
  id: string | null;
  activity_type_label: string | null;
  activity_type_color: string | null;
  direction: string | null;
  body: string | null;
  user_name: string | null;
  occurred_at: string | null;
  entity_type: string | null;
}

/** A deal related to a lead, enriched for the details panel. */
export interface LeadDeal {
  id: string | null;
  name: string | null;
  stage_label: string | null;
  stage_color: string | null;
  expected_value_minor: number | null;
  probability_pct: number | null;
  currency_code: string | null;
  owner_name: string | null;
  status: string | null;
}

/** A task related to a lead, enriched for the details panel. */
export interface LeadTask {
  id: string | null;
  title: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  due_at: string | null;
  completed_at: string | null;
  assignee_name: string | null;
  mode: string | null;
}

/** Filter options for the lead list (owners, sources, stages). */
export interface LeadFilterOptions {
  owners: { id: string; name: string }[];
  sources: Source[];
  stages: PipelineStage[];
}

/** Paginated lead list result from the server. */
export interface LeadPageResult {
  records: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------------- */
/* Deals module                                                           */
/* ---------------------------------------------------------------------- */

/** A deal row enriched for the list view (deal + company/lead/stage/owner). */
export interface DealListItem {
  id: string;
  name: string | null;
  /** Company name (from `establishments`). */
  company: string | null;
  /** Lead name (from `leads.full_name`). */
  leadName: string | null;
  /** Owner name (from `users`). */
  ownerName: string | null;
  /** Pipeline stage label + color (from the deal pipeline). */
  stage: { label: string | null; color: string | null } | null;
  /** Expected value in minor units. */
  expected_value_minor: number | null;
  /** Currency code, defaults to "SAR". */
  currency_code: string | null;
  /** Probability percentage. */
  probability_pct: number | null;
  /** Target close date (ISO string). */
  target_close_date: string | null;
  created_at: string | null;
  /** Terminal stage type (won/lost) for quick status context. */
  status: string | null;
  /** Stage id (used for filtering). */
  stageId: string | null;
  /** Owner id (used for filtering). */
  ownerId: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Full deal detail for the split-view details panel. */
export interface DealDetail {
  id: string;
  name: string | null;
  company: string | null;
  leadName: string | null;
  ownerName: string | null;
  stage: { label: string | null; color: string | null } | null;
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
  status: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** A deal activity enriched for the timeline. */
export interface DealActivity {
  id: string | null;
  activity_type_label: string | null;
  activity_type_color: string | null;
  direction: string | null;
  body: string | null;
  user_name: string | null;
  occurred_at: string | null;
  entity_type: string | null;
}

/** A deal task enriched for the details panel. */
export interface DealTask {
  id: string | null;
  title: string | null;
  task_type_label: string | null;
  task_type_color: string | null;
  due_at: string | null;
  completed_at: string | null;
  assignee_name: string | null;
  mode: string | null;
}

/** Filter options for the deal list (owners, stages, statuses). */
export interface DealFilterOptions {
  owners: { id: string; name: string }[];
  stages: PipelineStage[];
  statuses: PipelineStage[];
}

/** Paginated deal list result from the server. */
export interface DealPageResult {
  records: DealListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------------- */
/* Activities module                                                      */
/* ---------------------------------------------------------------------- */

/** A row from the `activity_types` table. */
export interface ActivityType {
  id: string | null;
  label: string | null;
  color: string | null;
  sort_order: number | null;
}

/** A row from the `task_types` table. */
export interface TaskType {
  id: string | null;
  label: string | null;
  color: string | null;
  sort_order: number | null;
}

/**
 * A unique CRM record (a Lead, Deal or Customer) that has activity history.
 *
 * The left table renders one row per record — never one row per activity.
 * `id` is a composite key of the form `entityType:entityId` used to load the
 * record's timeline on demand.
 */
export interface ActivityRecord {
  /** Composite id: `entityType:entityId`. */
  id: string;
  /** Actual entity id (lead id / deal id / establishment id). */
  entity_id: string;
  /** Entity type slug: `lead`, `deal` or `establishment`. */
  entity_type: string;
  /** Record display name (lead full name / deal name / establishment name). */
  name: string | null;
  /** Company (establishment) name. */
  company: string | null;
  /** Owner name (from `users`). */
  ownerName: string | null;
  /** Owner id (used for filtering). */
  ownerId: string | null;
  /** Stage id (used for filtering). */
  stageId: string | null;
  /** Latest activity timestamp across the record. */
  last_activity_at: string | null;
  /** Total number of activities for the record. */
  activity_count: number;
  /** Pipeline stage label + color (from `pipeline_stages`). */
  stage: { label: string | null; color: string | null } | null;
  /** Source label + color (from the record's / lead's source). */
  source: { label: string | null; color: string | null } | null;
  /** Phone (from the record / its lead). */
  phone: string | null;
  /** Email (from the record / its lead). */
  email: string | null;
  /** Distinct activity type ids present on the record (used for filtering). */
  activityTypeIds: string[];
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Record header info shown at the top of the timeline panel. */
export interface ActivityRecordDetail {
  id: string;
  entity_id: string;
  entity_type: string;
  name: string | null;
  company: string | null;
  ownerName: string | null;
  stage: { label: string | null; color: string | null } | null;
  source: { label: string | null; color: string | null } | null;
  phone: string | null;
  email: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** A single timeline entry (an activity or a task) for a record. */
export interface ActivityTimelineItem {
  id: string;
  /** `activity` or `task`. */
  kind: "activity" | "task";
  activity_type_id: string | null;
  activity_type_label: string | null;
  activity_type_color: string | null;
  /** Subject / body / title. */
  body: string | null;
  direction: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  user_name: string | null;
  occurred_at: string | null;
  /** Whether this activity/task was created by AI. */
  isAiCopy: boolean;
}

/** The composed payload for a record's timeline panel. */
export interface ActivityTimeline {
  record: ActivityRecordDetail;
  timeline: ActivityTimelineItem[];
}

/** Filter options for the activity records list (types, users, entity types). */
export interface ActivityFilterOptions {
  activityTypes: ActivityType[];
  users: { id: string; name: string }[];
  entityTypes: string[];
}

/* ---------------------------------------------------------------------- */
/* Tasks module                                                           */
/* ---------------------------------------------------------------------- */

/** A task row enriched for the list view. */
export interface TaskListItem {
  id: string;
  title: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  relatedRecordName: string | null;
  companyName: string | null;
  assignee_id: string | null;
  assigneeName: string | null;
  task_type_id: string | null;
  taskTypeLabel: string | null;
  taskTypeColor: string | null;
  mode: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
  status: "open" | "completed" | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Full task detail for the modal. */
export interface TaskDetail {
  id: string;
  title: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  relatedRecordName: string | null;
  companyName: string | null;
  assignee_id: string | null;
  assigneeName: string | null;
  task_type_id: string | null;
  taskTypeLabel: string | null;
  taskTypeColor: string | null;
  mode: string | null;
  due_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: "open" | "completed" | null;
  lead_id: string | null;
  deal_id: string | null;
  establishment_id: string | null;
  /** Whether this record was created by AI. */
  isAiCopy: boolean;
}

/** Summary of the record linked to a task. */
export interface TaskRelatedRecord {
  id: string;
  name: string | null;
  companyName: string | null;
  entity_type: string | null;
  stageLabel: string | null;
  stageColor: string | null;
  ownerName: string | null;
}

/** Filter options for the tasks list. */
export interface TaskFilterOptions {
  assignees: { id: string; name: string }[];
  taskTypes: TaskType[];
  entityTypes: string[];
}

/** Paginated task list result from the server. */
export interface TaskPageResult {
  records: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ---------------------------------------------------------------------- */
/* Reports module                                                         */
/* ---------------------------------------------------------------------- */

/** Date range filter for reports. */
export interface ReportDateRange {
  from: string;
  to: string;
}

/** Owner filter for reports. */
export interface ReportOwnerFilter {
  id: string;
  name: string;
}

/** Global report filters. */
export interface ReportFilters {
  dateRange: ReportDateRange;
  ownerId: string;
  pipeline: string;
  sourceId: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  dateRange: { from: "", to: "" },
  ownerId: "",
  pipeline: "",
  sourceId: "",
};

/** KPI card for reports dashboard. */
export interface ReportKpiCard {
  key: string;
  label: string;
  value: number | string;
  icon?: string;
  color?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    percentage: number;
    label: string;
  };
  format?: "percent";
}

/** Pipeline stage analytics. */
export interface PipelineStageAnalytics {
  stageId: string;
  stageLabel: string;
  stageColor: string | null;
  dealCount: number;
  totalValueMinor: number;
  pipeline: string | null;
}

/** Pipeline funnel data. */
export interface PipelineFunnel {
  stageId: string;
  stageLabel: string;
  stageColor: string | null;
  count: number;
  conversionRate: number;
}

/** Win vs Lost analytics. */
export interface WinLossAnalytics {
  won: number;
  lost: number;
  open: number;
  totalValueMinor: number;
  wonValueMinor: number;
  lostValueMinor: number;
}

/** Revenue by month data point. */
export interface RevenueByMonth {
  month: string;
  revenue: number;
  deals: number;
}

/** Average deal size data point. */
export interface AverageDealSize {
  month: string;
  average: number;
}

/** Deals created/closed by month. */
export interface DealsByMonth {
  month: string;
  created: number;
  closed: number;
}

/** Lead analytics by source. */
export interface LeadBySource {
  sourceId: string;
  sourceLabel: string;
  sourceColor: string | null;
  count: number;
}

/** Lead analytics by stage. */
export interface LeadByStage {
  stageId: string;
  stageLabel: string;
  stageColor: string | null;
  count: number;
}

/** Lead conversion funnel. */
export interface LeadConversionFunnel {
  stageId: string;
  stageLabel: string;
  stageColor: string | null;
  count: number;
  conversionRate: number;
}

/** Top source analytics. */
export interface TopSource {
  sourceId: string;
  sourceLabel: string;
  sourceColor: string | null;
  leads: number;
  deals: number;
  conversionRate: number;
}

/** Activity analytics by type. */
export interface ActivityByType {
  activityTypeId: string;
  activityTypeLabel: string;
  activityTypeColor: string | null;
  count: number;
  duration: number;
}

/** Activity analytics by user. */
export interface ActivityByUser {
  userId: string;
  userName: string;
  count: number;
  duration: number;
}

/** Activity analytics by month. */
export interface ActivityByMonth {
  month: string;
  count: number;
  duration: number;
}

/** Task analytics by status. */
export interface TaskByStatus {
  status: "open" | "completed";
  count: number;
}

/** Task analytics by type. */
export interface TaskByType {
  taskTypeId: string;
  taskTypeLabel: string;
  taskTypeColor: string | null;
  count: number;
  completed: number;
}

/** Task analytics by user. */
export interface TaskByUser {
  userId: string;
  userName: string;
  open: number;
  completed: number;
  total: number;
}

/** Overdue task analytics. */
export interface OverdueTask {
  id: string;
  title: string | null;
  due_at: string | null;
  assigneeName: string | null;
  daysOverdue: number;
}

/** Owner performance analytics. */
export interface OwnerPerformance {
  ownerId: string;
  ownerName: string;
  deals: number;
  revenue: number;
  wonDeals: number;
  activities: number;
  tasks: number;
  conversionRate: number;
}

/** Top customer for reports. */
export interface TopCustomer {
  id: string;
  name: string | null;
  dealCount: number;
  totalRevenue: number;
  activitiesCount: number;
  tasksCount: number;
}

/** Complete report data payload. */
export interface ReportData {
  kpis: ReportKpiCard[];
  pipeline: {
    byStage: PipelineStageAnalytics[];
    funnel: PipelineFunnel[];
    winLoss: WinLossAnalytics;
  };
  revenue: {
    byMonth: RevenueByMonth[];
    averageDealSize: AverageDealSize[];
    dealsByMonth: DealsByMonth[];
  };
  leads: {
    bySource: LeadBySource[];
    byStage: LeadByStage[];
    conversionFunnel: LeadConversionFunnel[];
    topSources: TopSource[];
  };
  activities: {
    byType: ActivityByType[];
    byUser: ActivityByUser[];
    byMonth: ActivityByMonth[];
  };
  tasks: {
    byStatus: TaskByStatus[];
    byType: TaskByType[];
    byUser: TaskByUser[];
    overdue: OverdueTask[];
  };
  owners: OwnerPerformance[];
  recentDeals: RecentDeal[];
  topCustomers: TopCustomer[];
}

/* ---------------------------------------------------------------------- */
/* AI Workspace module                                                    */
/* ---------------------------------------------------------------------- */

/** Overview KPI card for the AI workspace. */
export interface AiOverviewCard {
  key: string;
  label: string;
  value: number | string;
  icon?: string;
  color?: string;
  format?: "percent";
}

/** Calculated metrics returned by `getAiOverview`. */
export interface AiCalculatedMetrics {
  leadConversionRate: number;
  averageDealValue: number;
  winRate: number;
  overdueTaskCount: number;
  inactiveCustomers: number;
  dealsWithNoRecentActivity: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenueMinor: number;
  openTasks: number;
  leads: number;
}

/** Top owner record used inside insights and recommendations. */
export interface AiOwnerSummary {
  ownerId: string;
  ownerName: string;
  wonDeals: number;
  totalDeals: number;
  conversionRate: number;
  overdueTasks: number;
  totalTasks: number;
}

/** Risk deal returned by the AI workspace. */
export interface AiRiskDeal {
  id: string;
  name: string | null;
  customerName: string | null;
  stageLabel: string | null;
  stageColor: string | null;
  expectedValueMinor: number | null;
  currencyCode: string | null;
  ownerName: string | null;
  daysSinceUpdate: number;
  probabilityPct: number | null;
}

/** Inactive customer returned by the AI workspace. */
export interface AiInactiveCustomer {
  id: string;
  name: string | null;
  city: string | null;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  dealCount: number;
  ownerName: string | null;
}

/** Complete AI workspace data payload. */
export interface AiData {
  overview: {
    totals: {
      customers: number;
      leads: number;
      deals: number;
      activities: number;
      tasks: number;
    };
    metrics: AiCalculatedMetrics;
  };
  insights: AiInsight[];
  recommendations: AiRecommendation[];
  executiveSummary: string;
  riskDeals: AiRiskDeal[];
  inactiveCustomers: AiInactiveCustomer[];
  topOwners: AiOwnerSummary[];
  globalAnalysis: {
    todayPriorities: Array<{
      type: string;
      id: string;
      label: string;
      reason: string;
      value: string;
    }>;
    atRiskDeals: Array<{
      id: string;
      name: string;
      company: string | null;
      stage: string | null;
      expectedValueMinor: number | null;
      riskLevel: string;
      reason: string;
    }>;
    customersRequiringAttention: Array<{
      id: string;
      name: string;
      reason: string;
      daysSinceActivity: number | null;
      openDeals: number;
    }>;
    overdueTasksSummary: {
      total: number;
      byAssignee: Record<string, number>;
      linkedToHighValueDeals: number;
    };
    followUpOpportunities: Array<{
      id: string;
      label: string;
      reason: string;
    }>;
    topPerformers: Array<{
      id: string;
      name: string;
      wonDeals: number;
      conversionRate: number;
    }>;
    timeline: Array<{
      date: string;
      events: Array<{
        kind: string;
        body: string;
        userName: string;
      }>;
    }>;
  };
  dailyBriefing?: {
    executiveSummary: string;
    todayPriorities: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      value?: number;
      currency?: string;
    }>;
    atRiskDeals: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      riskScore: number;
      riskLevel: string;
      expectedValueMinor: number | null;
      currencyCode: string | null;
    }>;
    customersRequiringAttention: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      daysSinceActivity: number | null;
      openDeals: number;
    }>;
    overdueTasks: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      daysOverdue: number;
      relatedRecordValueMinor: number | null;
    }>;
    suggestedFollowUps: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      daysSinceActivity: number | null;
    }>;
    opportunities: Array<{
      entityType: string;
      entityId: string;
      entityName: string;
      priority: string;
      priorityScore: number;
      reason: string;
      evidence: string[];
      recommendedAction: string;
      expectedValueMinor: number | null;
    }>;
    employeeSummary: {
      overdueTasks: number;
      todayTasks: number;
      highPriorityDeals: number;
      customersNeedingAttention: number;
      leadsNeedingFollowUp: number;
      recommendedActions: string[];
    };
  };
  lossPatterns: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    sampleSize: number;
    confidence: string;
    businessImpact: string;
  }>;
  conversionPatterns: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    sampleSize: number;
    confidence: string;
    businessImpact: string;
  }>;
  stageBottlenecks: Array<{
    id: string;
    stage: string;
    stageColor: string | null;
    totalDeals: number;
    avgDaysInStage: number;
    stalledDeals: number;
    bottleneckScore: number;
    severity: string;
    recommendation: string;
  }>;
}

/** A single AI insight derived from CRM data. */
export interface AiInsight {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}

/** A single AI recommendation derived from CRM data. */
export interface AiRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
}

/* ------------------------------------------------------------------ */
/* Phase 17 — Predictive AI & Advanced CRM Intelligence               */
/* ------------------------------------------------------------------ */

export interface DealHealthScore {
  score: number;
  level: "healthy" | "at-risk" | "stalled" | "critical";
  factors: string[];
}

export interface RiskScore {
  overall: number;
  level: "low" | "medium" | "high" | "critical";
  categories: {
    inactivity: number;
    engagementDecline: number;
    overdueTasks: number;
    closeDatePressure: number;
    stageStagnation: number;
    lowHistoricalConversion: number;
    ownerWorkload: number;
    missingInfo: number;
    unusualBehavior: number;
  };
  primaryRisk: string;
  secondaryRisks: string[];
}

export interface OpportunityScore {
  score: number;
  level: "low" | "medium" | "high";
  factors: string[];
  evidence: string[];
}

export interface HistoricalBenchmark {
  comparableDeals: number;
  won: number;
  lost: number;
  stalled: number;
  historicalWinRate: number;
  avgTimeToClose: number | null;
  avgStageDuration: number | null;
  avgActivityFrequency: number | null;
  confidence: "high" | "medium" | "low";
}

export interface SimilarDeal {
  id: string;
  name: string;
  stage: string;
  outcome: string | null;
  expectedValueMinor: number | null;
  daysToClose: number | null;
  similarityScore: number;
}

export interface TemporalAnalysis {
  engagementTrend: "increasing" | "stable" | "decreasing" | "none";
  activityTrend: "increasing" | "stable" | "decreasing" | "none";
  responseTrend: "increasing" | "stable" | "decreasing" | "none";
  taskCompletionTrend: "increasing" | "stable" | "decreasing" | "none";
  inactivityPeriods: Array<{ start: string; end: string; days: number }>;
  acceleration: "accelerating" | "stable" | "decelerating" | "unknown";
  evidence: string[];
}

export interface TurningPoint {
  date: string;
  type: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export interface Anomaly {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
  evidence: string[];
}

export interface NextBestAction {
  action: string;
  priority: "high" | "medium" | "low";
  why: string;
  expectedImpact: string[];
  deadline: string | null;
}

export interface WhatIfScenario {
  scenario: string;
  estimatedProbability: number | null;
  estimatedRisk: number | null;
  reasoning: string;
  confidence: "high" | "medium" | "low";
}

export interface DataQualityAssessment {
  score: number;
  missingFields: string[];
  completeness: Record<string, boolean>;
  impactOnConfidence: string;
}

export interface ExplainablePrediction {
  positiveFactors: string[];
  negativeFactors: string[];
  neutralFactors: string[];
  historicalEvidence: string[];
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
}

export interface EnhancedDealPredictions {
  winProbability: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  stagnationRisk: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  aiWinProbability: number;
  aiLossProbability: number;
  aiStallProbability: number;
  overallConfidence: "high" | "medium" | "low";
  expectedCloseWindow: string | null;
  dealHealth: DealHealthScore;
  riskScore: RiskScore;
  opportunityScore: OpportunityScore;
  historicalBenchmark: HistoricalBenchmark;
  similarDeals: SimilarDeal[];
  temporalAnalysis: TemporalAnalysis;
  turningPoints: TurningPoint[];
  anomalies: Anomaly[];
  nextBestAction: NextBestAction;
  whatIfScenarios: WhatIfScenario[];
  dataQuality: DataQualityAssessment;
  explainability: ExplainablePrediction;
}

export interface EnhancedCustomerPredictions {
  churnRisk: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  relationshipHealth: { score: number; level: string; factors: string[] };
  opportunityScore: OpportunityScore;
  nextBestAction: NextBestAction;
  dataQuality: DataQualityAssessment;
}

export interface EnhancedLeadPredictions {
  conversionProbability: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  followUpPriority: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  engagementScore: { value: number; confidence: "high" | "medium" | "low"; basis: string[]; explanation: string };
  leadHealth: { score: number; level: string; factors: string[] };
  opportunityScore: OpportunityScore;
  nextBestAction: NextBestAction;
  dataQuality: DataQualityAssessment;
}

/* ------------------------------------------------------------------ */
/* Phase 20 — Causal + Decision Engine                                 */
/* ------------------------------------------------------------------ */

export * from "./causal";
export * from "./decision";
export * from "./process";
export * from "./customer-package";


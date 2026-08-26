/**
 * Shared, framework-free constants for the CRM.
 *
 * Keep purely static values here (no React components, no DB access)
 * so they can be safely imported by both client and server code.
 */

export const APP_NAME = "Mawrid CRM";

export const APP_DESCRIPTION =
  "AI-powered CRM for modern sales teams.";

/** Supported locales for the language switch. */
export const LOCALES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

/**
 * Default pagination size used by services and the reusable Pagination UI.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The database stores currency amounts in "minor" units (e.g. cents).
 * Divide by this factor to get the base unit.
 */
export const MINOR_UNIT = 100;

/** Default currency code used when undefined in the DB. */
export const DEFAULT_CURRENCY = "SAR";

/** Table names used by the service layer. */
export const TABLES = {
  users: "users",
  customers: "establishments",
  contacts: "contacts",
  leads: "leads",
  deals: "deals",
  tasks: "tasks",
  activities: "activities",
  activity_types: "activity_types",
  task_types: "task_types",
  stages: "pipeline_stages",
  sources: "sources",
  industries: "industries",
  notes: "notes",
  audit_log: "audit_log",
  knowledge_graph_memories: "knowledge_graph_memories",
  events: "crm_events",
  process_definitions: "process_definitions",
  process_instances: "process_instances",
  process_executions: "process_executions",
  lost_reasons: "lost_reasons",
  activity_mentions: "activity_mentions",
} as const;

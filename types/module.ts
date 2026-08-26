export type ModuleKey =
  | "customers"
  | "leads"
  | "deals"
  | "activities"
  | "tasks"
  | "reports"
  | "replay"
  | "graph"
  | "ai"
  | "settings"
  | "dashboard"
  | "modules"
  | "digital-twin";

export interface ModuleDefinition {
  key: ModuleKey;
  labelKey: string;
  icon: string;
  href: string;
  table: string;
  enabled: boolean;
  order: number;
  descriptionKey?: string;
  allowedRoles?: string[];
}

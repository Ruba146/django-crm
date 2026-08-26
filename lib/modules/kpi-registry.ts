import type { KpiCard } from "@/types";

export interface KpiModuleRegistration {
  key: KpiCard["key"];
  labelKey: string;
  enabled: boolean;
  order: number;
  icon?: string;
  color?: string;
}

export const KPI_MODULES: KpiModuleRegistration[] = [
  {
    key: "customers",
    labelKey: "dashboard.customers",
    enabled: true,
    order: 0,
    icon: "Users",
    color: "#2563eb",
  },
  {
    key: "leads",
    labelKey: "dashboard.leads",
    enabled: true,
    order: 1,
    icon: "UserPlus",
    color: "#7c3aed",
  },
  {
    key: "deals",
    labelKey: "dashboard.deals",
    enabled: true,
    order: 2,
    icon: "Handshake",
    color: "#059669",
  },
  {
    key: "activities",
    labelKey: "dashboard.activities",
    enabled: true,
    order: 3,
    icon: "Activity",
    color: "#db2777",
  },
  {
    key: "tasks",
    labelKey: "dashboard.tasks",
    enabled: true,
    order: 4,
    icon: "CheckSquare",
    color: "#d97706",
  },
];

export function getEnabledKpiModules(): KpiModuleRegistration[] {
  return KPI_MODULES.filter((m) => m.enabled).sort((a, b) => a.order - b.order);
}

import type { ModuleDefinition, ModuleKey } from "@/types/module";
export type { ModuleDefinition, ModuleKey };

export const MODULES: ModuleDefinition[] = [
  {
    key: "dashboard",
    labelKey: "nav.dashboard",
    icon: "LayoutDashboard",
    href: "/",
    table: "",
    enabled: true,
    order: 0,
  },
  {
    key: "customers",
    labelKey: "nav.customers",
    icon: "Users",
    href: "/customers",
    table: "establishments",
    enabled: true,
    order: 1,
    descriptionKey: "modules.customers.description",
  },
  {
    key: "leads",
    labelKey: "nav.leads",
    icon: "UserPlus",
    href: "/leads",
    table: "leads",
    enabled: true,
    order: 2,
    descriptionKey: "modules.leads.description",
  },
  {
    key: "deals",
    labelKey: "nav.deals",
    icon: "Handshake",
    href: "/deals",
    table: "deals",
    enabled: true,
    order: 3,
    descriptionKey: "modules.deals.description",
  },
  {
    key: "activities",
    labelKey: "nav.activities",
    icon: "Activity",
    href: "/activities",
    table: "activities",
    enabled: true,
    order: 4,
    descriptionKey: "modules.activities.description",
  },
  {
    key: "tasks",
    labelKey: "nav.tasks",
    icon: "CheckSquare",
    href: "/tasks",
    table: "tasks",
    enabled: true,
    order: 5,
    descriptionKey: "modules.tasks.description",
  },
  {
    key: "replay",
    labelKey: "nav.replay",
    icon: "Network",
    href: "/replay",
    table: "",
    enabled: true,
    order: 6,
  },
  {
    key: "graph",
    labelKey: "nav.graph",
    icon: "Network",
    href: "/graph",
    table: "",
    enabled: true,
    order: 7,
  },
  {
    key: "digital-twin",
    labelKey: "nav.digitalTwin",
    icon: "ScanSearch",
    href: "/digital-twin",
    table: "",
    enabled: true,
    order: 8,
  },
  {
    key: "reports",
    labelKey: "nav.reports",
    icon: "BarChart3",
    href: "/reports",
    table: "",
    enabled: true,
    order: 8,
  },
  {
    key: "ai",
    labelKey: "nav.ai",
    icon: "Sparkles",
    href: "/ai",
    table: "",
    enabled: true,
    order: 9,
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    icon: "Settings",
    href: "/settings",
    table: "",
    enabled: true,
    order: 10,
  },
  {
    key: "modules",
    labelKey: "nav.modules",
    icon: "Layers",
    href: "/modules",
    table: "",
    enabled: true,
    order: 11,
    descriptionKey: "modules.adminDescription",
  },
];

export function getModule(key: ModuleKey): ModuleDefinition | undefined {
  return MODULES.find((m) => m.key === key);
}

export function getEnabledModules(): ModuleDefinition[] {
  return MODULES.filter((m) => m.enabled).sort((a, b) => a.order - b.order);
}

export function getNavModules(): ModuleDefinition[] {
  return getEnabledModules().filter((m) => m.key !== "dashboard");
}

export function isModuleEnabled(key: ModuleKey): boolean {
  return MODULES.some((m) => m.key === key && m.enabled);
}

import {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Activity,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Network,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { key: "customers", href: "/customers", labelKey: "nav.customers", icon: Users },
  { key: "leads", href: "/leads", labelKey: "nav.leads", icon: UserPlus },
  { key: "deals", href: "/deals", labelKey: "nav.deals", icon: Handshake },
  { key: "activities", href: "/activities", labelKey: "nav.activities", icon: Activity },
  { key: "tasks", href: "/tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { key: "replay", href: "/replay", labelKey: "nav.replay", icon: Network },
  { key: "graph", href: "/graph", labelKey: "nav.graph", icon: Network },
  { key: "reports", href: "/reports", labelKey: "nav.reports", icon: BarChart3 },
  { key: "ai", href: "/ai", labelKey: "nav.ai", icon: Sparkles },
  { key: "settings", href: "/settings", labelKey: "nav.settings", icon: Settings },
];

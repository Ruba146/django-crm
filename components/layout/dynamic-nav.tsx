"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Layers,
  Network,
  ScanSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "@/hooks/use-translations";
import { useSidebarStore } from "@/stores/sidebar-store";
import { getNavModules, type ModuleDefinition } from "@/lib/modules/registry";
import { cn } from "@/utils/cn";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Activity,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Layers,
  Network,
  ScanSearch,
};

export function DynamicNavItems() {
  const modules = getNavModules();
  const { t } = useTranslations();
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const closeMobile = useSidebarStore((s) => s.closeMobile);

  const resolveIcon = (module: ModuleDefinition): LucideIcon => {
    return ICON_MAP[module.icon] ?? LayoutDashboard;
  };

  const isGraphPage = pathname === "/graph" || pathname.startsWith("/graph/");

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Sparkles className="size-4" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">
            {t("common.appName")}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2 no-scrollbar">
        {modules.map((item) => {
          const Icon = resolveIcon(item);
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                isGraphPage && !collapsed && "px-2.5",
                active
                  ? "bg-primary-600 text-white shadow-soft"
                  : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-sidebar-border p-2 lg:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            collapsed && "justify-center px-2",
            isGraphPage && !collapsed && "px-2.5"
          )}
        >
          {collapsed ? (
            <Network className="size-[18px] rtl:rotate-180" />
          ) : (
            <>
              <LayoutDashboard className="size-[18px] rtl:rotate-180" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-screen shrink-0 border-e border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : isGraphPage ? "w-[150px]" : "w-60"
        )}
      >
        {content}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobile}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 start-0 z-50 w-64 border-e border-sidebar-border bg-sidebar lg:hidden"
            >
              <button
                type="button"
                onClick={closeMobile}
                className="absolute end-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

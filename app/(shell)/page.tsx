import { DashboardGrid } from "@/components/dashboard";
import {
  getDashboardStats,
  getPipelineData,
  getRecentActivities,
  getRecentDeals,
  getUpcomingTasks,
} from "@/services/dashboard.service";
import type { KpiCard } from "@/types";
import { getEnabledKpiModules } from "@/lib/modules/kpi-registry";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getDashboardStats();

  const kpiCards: KpiCard[] = getEnabledKpiModules().map((m) => ({
    key: m.key,
    label: m.labelKey,
    value: stats[m.key as keyof typeof stats] as number,
  }));

  const pipeline = getPipelineData();
  const recentActivities = getRecentActivities(10);
  const upcomingTasks = getUpcomingTasks(10);
  const recentDeals = getRecentDeals(5);

  return (
    <DashboardGrid
      kpiCards={kpiCards}
      pipeline={pipeline}
      recentActivities={recentActivities}
      upcomingTasks={upcomingTasks}
      recentDeals={recentDeals}
    />
  );
}

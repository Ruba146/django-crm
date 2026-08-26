import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PipelineWidget } from "@/components/dashboard/pipeline-widget";
import { RecentActivitiesWidget } from "@/components/dashboard/recent-activities-widget";
import { UpcomingTasksWidget } from "@/components/dashboard/upcoming-tasks-widget";
import { RecentDealsWidget } from "@/components/dashboard/recent-deals-widget";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget";
import { AIInsightsPlaceholder } from "@/components/dashboard/ai-insights-placeholder";
import type {
  KpiCard,
  PipelineData,
  RecentActivity,
  RecentDeal,
  UpcomingTask,
} from "@/types";

/**
 * Dashboard grid — composes all dashboard widgets into a responsive layout.
 * A server component: it only receives already-fetched data and arranges
 * the isolated, reusable widgets. No database access here.
 */
export function DashboardGrid({
  kpiCards,
  pipeline,
  recentActivities,
  upcomingTasks,
  recentDeals,
  locale = "en",
}: {
  kpiCards: KpiCard[];
  pipeline: PipelineData[];
  recentActivities: RecentActivity[];
  upcomingTasks: UpcomingTask[];
  recentDeals: RecentDeal[];
  locale?: string;
}) {
  return (
    <div className="space-y-6" aria-labelledby="dashboard-heading">
      <DashboardHeader />

      {/* KPI row */}
      <KPICards cards={kpiCards} locale={locale} />

      {/* Main grid: pipeline spans one column, activities the other */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PipelineWidget stages={pipeline} locale={locale} />
        <RecentActivitiesWidget activities={recentActivities} locale={locale} />
      </div>

      {/* Secondary row: tasks + deals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingTasksWidget tasks={upcomingTasks} locale={locale} />
        <RecentDealsWidget deals={recentDeals} locale={locale} />
      </div>

      {/* Action / AI row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActionsWidget />
        <AIInsightsPlaceholder />
      </div>
    </div>
  );
}

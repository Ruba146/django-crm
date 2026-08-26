import { getReportData, getReportFilterOptions } from "@/services/report.service";
import { ReportsHeader } from "@/components/reports";
import { ReportsFilters } from "@/components/reports";
import { ReportKpiCards } from "@/components/reports";
import { PipelineAnalytics } from "@/components/reports";
import { SalesAnalytics } from "@/components/reports";
import { LeadAnalytics } from "@/components/reports";
import { ActivityAnalytics } from "@/components/reports";
import { TaskAnalytics } from "@/components/reports";
import { TopPerformers } from "@/components/reports";
import { RecentBusiness } from "@/components/reports";
import type { ReportFilters, ReportData } from "@/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const filters: ReportFilters = {
    dateRange: {
      from: typeof resolved.from === "string" ? resolved.from : "",
      to: typeof resolved.to === "string" ? resolved.to : "",
    },
    ownerId: typeof resolved.owner === "string" ? resolved.owner : "",
    pipeline: typeof resolved.pipeline === "string" ? resolved.pipeline : "",
    sourceId: typeof resolved.source === "string" ? resolved.source : "",
  };

  const data: ReportData = getReportData(filters);

  const filterOptions = getReportFilterOptions();

  return (
    <div className="space-y-6">
      <ReportsHeader />
      <form method="get" className="space-y-4">
        <ReportsFilters filters={filters} filterOptions={filterOptions} />
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Apply Filters
          </button>
        </div>
      </form>
      <ReportKpiCards cards={data.kpis} />
      <PipelineAnalytics
        byStage={data.pipeline.byStage}
        funnel={data.pipeline.funnel}
        winLoss={data.pipeline.winLoss}
      />
      <SalesAnalytics
        revenueByMonth={data.revenue.byMonth}
        averageDealSize={data.revenue.averageDealSize}
        dealsByMonth={data.revenue.dealsByMonth}
      />
      <LeadAnalytics
        bySource={data.leads.bySource}
        byStage={data.leads.byStage}
        conversionFunnel={data.leads.conversionFunnel}
        topSources={data.leads.topSources}
      />
      <ActivityAnalytics
        byType={data.activities.byType}
        byUser={data.activities.byUser}
        byMonth={data.activities.byMonth}
      />
      <TaskAnalytics
        byStatus={data.tasks.byStatus}
        byType={data.tasks.byType}
        byUser={data.tasks.byUser}
        overdue={data.tasks.overdue}
      />
      <TopPerformers owners={data.owners} />
      <RecentBusiness recentDeals={data.recentDeals} topCustomers={data.topCustomers} />
    </div>
  );
}

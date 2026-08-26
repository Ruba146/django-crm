import type { ReportFilters } from "@/types";

interface ReportsFiltersProps {
  filters: ReportFilters;
  filterOptions: {
    owners: { id: string; name: string }[];
    pipelines: string[];
    sources: { id: string; label: string; color: string | null }[];
  };
}

export function ReportsFilters({ filters, filterOptions }: ReportsFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Date Range</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="from"
            defaultValue={filters.dateRange.from}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.dateRange.to}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Owner</label>
        <select
          name="owner"
          defaultValue={filters.ownerId}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Owners</option>
          {filterOptions.owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Pipeline</label>
        <select
          name="pipeline"
          defaultValue={filters.pipeline}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Pipelines</option>
          {filterOptions.pipelines.map((pipeline) => (
            <option key={pipeline} value={pipeline}>
              {pipeline}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Lead Source</label>
        <select
          name="source"
          defaultValue={filters.sourceId}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Sources</option>
          {filterOptions.sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

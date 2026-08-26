import { Download, Plus, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";

/**
 * Lead page header — title, live lead count and toolbar actions
 * (Create Lead [UI only], export + refresh). Presentational; data passed in.
 */
export function LeadHeader({
  total,
  locale = "en",
  onRefresh,
  refetching = false,
  onExport,
  onCreateLead,
}: {
  total: number;
  locale?: string;
  onRefresh?: () => void;
  refetching?: boolean;
  onExport?: () => void;
  onCreateLead?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <UserPlus className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="leads-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Leads
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatNumber(total, locale)} {total === 1 ? "lead" : "leads"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Export leads"
        >
          <Download className="size-4" aria-hidden="true" />
          Export
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refetching}
          aria-label="Refresh leads"
        >
          <RefreshCw
            className={cn("size-4", refetching && "animate-spin")}
            aria-hidden="true"
          />
          {refetching ? "Refreshing…" : "Refresh"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onCreateLead}
          aria-label="Create lead"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create Lead
        </Button>
      </div>
    </header>
  );
}

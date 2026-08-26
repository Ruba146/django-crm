import { Building2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";

/**
 * Customer page header — title, live customer count and toolbar actions
 * (refresh + export). Presentational; data passed in as props.
 */
export function CustomerHeader({
  total,
  locale = "en",
  onRefresh,
  refetching = false,
  onExport,
}: {
  total: number;
  locale?: string;
  onRefresh?: () => void;
  refetching?: boolean;
  onExport?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <Building2 className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="customers-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Customers
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatNumber(total, locale)}{" "}
            {total === 1 ? "customer" : "customers"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Export customers"
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
          aria-label="Refresh customers"
        >
          <RefreshCw
            className={cn("size-4", refetching && "animate-spin")}
            aria-hidden="true"
          />
          {refetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </header>
  );
}

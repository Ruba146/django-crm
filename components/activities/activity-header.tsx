import { Activity, Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";

/**
 * Activity page header — title, live activity count and toolbar actions
 * (Create Activity [UI only], export + refresh). Presentational; data passed in.
 */
export function ActivityHeader({
  total,
  locale = "en",
  onRefresh,
  refetching = false,
  onExport,
  onCreateActivity,
}: {
  total: number;
  locale?: string;
  onRefresh?: () => void;
  refetching?: boolean;
  onExport?: () => void;
  onCreateActivity?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <Activity className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="activities-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Activities
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatNumber(total, locale)}{" "}
            {total === 1 ? "activity" : "activities"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Export activities"
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
          aria-label="Refresh activities"
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
          onClick={onCreateActivity}
          aria-label="Create activity"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create Activity
        </Button>
      </div>
    </header>
  );
}


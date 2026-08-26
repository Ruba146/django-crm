import { CheckSquare, Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";

/**
 * Task page header — title, live task count and toolbar actions
 * (Create Task [UI only], export + refresh). Presentational; data passed in.
 */
export function TaskHeader({
  total,
  locale = "en",
  onRefresh,
  refetching = false,
  onExport,
  onCreateTask,
}: {
  total: number;
  locale?: string;
  onRefresh?: () => void;
  refetching?: boolean;
  onExport?: () => void;
  onCreateTask?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <CheckSquare className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="tasks-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Tasks
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatNumber(total, locale)} {total === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Export tasks"
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
          aria-label="Refresh tasks"
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
          onClick={onCreateTask}
          aria-label="Create task"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create Task
        </Button>
      </div>
    </header>
  );
}

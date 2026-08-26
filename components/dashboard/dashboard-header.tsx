import { CalendarDays, RefreshCw, Search } from "lucide-react";
import { formatDate } from "@/utils/format";

/**
 * Dashboard header — greeting, current date and quick actions.
 * This is a server component (no client hooks): the refresh button is a
 * UI-only affordance that reloads the current page via a plain link so the
 * server components re-run and pull fresh data from the database.
 */
export function DashboardHeader() {
  const today = new Date();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <CalendarDays className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1
            id="dashboard-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Good day 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Here is a live overview of your CRM today, {formatDate(today)}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <kbd
          aria-label="Search shortcut"
          className="hidden items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm lg:inline-flex"
        >
          <Search className="size-3.5" aria-hidden="true" />
          Search
          <span className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌘K
          </span>
        </kbd>
        <a
          href="?refresh=1"
          aria-label="Refresh dashboard data"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </a>
      </div>
    </header>
  );
}


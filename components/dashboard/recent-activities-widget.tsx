import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { RecentActivity } from "@/types";

/**
 * Recent activities widget — latest 10 activities from the database.
 * Displays an icon, title, related customer and timestamp. Presentational:
 * data is passed in as props from a server component.
 */
export function RecentActivitiesWidget({
  activities,
  locale = "en",
}: {
  activities: RecentActivity[];
  locale?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Recent Activities</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">Latest 10</span>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            title="No activities yet"
            description="Activities will appear here as your team logs calls, emails and meetings."
          />
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((a) => (
              <li key={a.id ?? `${a.occurred_at}-${a.body}`} className="flex gap-3 py-3">
                <span
                  className={cn(
                    "mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    a.activity_type_color
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300"
                  )}
                  aria-hidden="true"
                >
                  <Activity className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.activity_type_label ?? a.direction ?? "Activity"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.entity_name ?? a.body ?? "—"}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={a.occurred_at ?? undefined}
                >
                  {formatDateTime(a.occurred_at, locale)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

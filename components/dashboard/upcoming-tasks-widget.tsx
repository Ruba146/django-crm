import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { formatDate } from "@/utils/format";
import type { UpcomingTask } from "@/types";

/** Map a task mode to a badge tone. */
function modeVariant(
  mode: string | null | undefined
): "warning" | "info" | "neutral" {
  switch (mode) {
    case "call":
      return "info";
    case "meeting":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Upcoming tasks widget — next 10 open tasks ordered by due date.
 * Shows task title, due date and owner. Presentational.
 */
export function UpcomingTasksWidget({
  tasks,
  locale = "en",
}: {
  tasks: UpcomingTask[];
  locale?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CalendarClock
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle>Upcoming Tasks</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">Next 10</span>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            title="All caught up"
            description="You have no open tasks due in the near future."
          />
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li
                key={t.id ?? `${t.due_at}-${t.title}`}
                className="flex items-center gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  {t.task_type_label && (
                    <span className="text-xs text-muted-foreground">
                      {t.task_type_label}
                    </span>
                  )}
                </div>
                <Badge variant={modeVariant(t.mode)}>{t.mode ?? "task"}</Badge>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={t.due_at ?? undefined}
                >
                  {formatDate(t.due_at, locale)}
                </time>
                <Avatar
                  name={t.assignee_name ?? "?"}
                  size="sm"
                  fallback={(t.assignee_name ?? "?")[0]?.toUpperCase()}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

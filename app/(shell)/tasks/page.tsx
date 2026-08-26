import { TasksView } from "@/components/tasks";
import {
  getTaskFilterOptions,
} from "@/services/task.service";

/**
 * Tasks page — server component.
 *
 * Reads filter options directly from the existing SQLite database via the
 * task service layer, then hands them to the client-side `TasksView` which
 * fetches paginated records from `/api/records`. No fake data: every row
 * comes from SQLite.
 */
export const dynamic = "force-dynamic";

export default function TasksPage() {
  const filterOptions = getTaskFilterOptions();

  return <TasksView filterOptions={filterOptions} />;
}

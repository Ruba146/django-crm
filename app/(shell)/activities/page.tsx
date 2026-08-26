import { ActivitiesView } from "@/components/activities";
import {
  getActivityFilterOptions,
  getActivityRecords,
} from "@/services/activity.service";

/**
 * Activities page — server component.
 *
 * Reads the distinct records (Leads / Deals / Customers) that have activity
 * history plus the filter options directly from the existing SQLite database
 * via the activity service layer, then hands them to the client-side
 * `ActivitiesView`. The view renders ONE row per record and loads each
 * record's full timeline on demand — thousands of activities are never
 * preloaded. No fake data: every row comes from SQLite.
 */
export const dynamic = "force-dynamic";

export default function ActivitiesPage() {
  const records = getActivityRecords();
  const filterOptions = getActivityFilterOptions();

  return <ActivitiesView records={records} filterOptions={filterOptions} />;
}

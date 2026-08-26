import { LeadsView } from "@/components/leads";
import {
  getLeadFilterOptions,
} from "@/services/lead.service";

/**
 * Leads page — server component.
 *
 * Reads filter options directly from the existing SQLite database via the
 * lead service layer, then hands them to the client-side `LeadsView` which
 * fetches paginated records from `/api/records`. No fake data: every row
 * comes from SQLite.
 */
export const dynamic = "force-dynamic";

export default function LeadsPage() {
  const filterOptions = getLeadFilterOptions();

  return <LeadsView filterOptions={filterOptions} />;
}

import { DealsView } from "@/components/deals";
import { getDealFilterOptions } from "@/services/deal.service";

/**
 * Deals page — server component.
 *
 * Reads filter options directly from the existing SQLite database via the
 * deal service layer, then hands them to the client-side `DealsView` which
 * fetches paginated records from `/api/records`. No fake data: every row
 * comes from SQLite.
 */
export const dynamic = "force-dynamic";

export default function DealsPage() {
  const filterOptions = getDealFilterOptions();

  return <DealsView filterOptions={filterOptions} />;
}

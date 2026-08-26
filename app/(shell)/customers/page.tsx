import { CustomersView } from "@/components/customers";
import {
  getCustomerFilterOptions,
} from "@/services/customer.service";

/**
 * Customers page — server component.
 *
 * Reads filter options directly from the existing SQLite database via the
 * customer service layer, then hands them to the client-side `CustomersView`
 * which fetches paginated records from `/api/records`. No fake data: every
 * row comes from SQLite.
 */
export const dynamic = "force-dynamic";

export default function CustomersPage() {
  const filterOptions = getCustomerFilterOptions();

  return <CustomersView filterOptions={filterOptions} />;
}

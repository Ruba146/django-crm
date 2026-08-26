import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Empty state for the customer list. Reuses the existing EmptyState
 * component with a customer-specific icon.
 */
export function CustomerEmptyState({
  title = "No customers found",
  description = "Try adjusting your search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Building2 className="size-6" aria-hidden="true" />}
    />
  );
}

import { UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Empty state for the lead list. Reuses the existing EmptyState
 * component with a lead-specific icon.
 */
export function LeadEmptyState({
  title = "No leads found",
  description = "Try adjusting your search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<UserPlus className="size-6" aria-hidden="true" />}
    />
  );
}

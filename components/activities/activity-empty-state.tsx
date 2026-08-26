import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Empty state for the activity list. Reuses the existing EmptyState
 * component with an activity-specific icon.
 */
export function ActivityEmptyState({
  title = "No records found",
  description = "Try adjusting your search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Activity className="size-6" aria-hidden="true" />}
    />
  );
}


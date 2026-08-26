import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Empty state for the task list. Reuses the existing EmptyState
 * component with a task-specific icon.
 */
export function TaskEmptyState({
  title = "No tasks found",
  description = "Try adjusting your search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<CheckSquare className="size-6" aria-hidden="true" />}
    />
  );
}

import { Handshake } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Empty state for the deal list. Reuses the existing EmptyState
 * component with a deal-specific icon.
 */
export function DealEmptyState({
  title = "No deals found",
  description = "Try adjusting your search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Handshake className="size-6" aria-hidden="true" />}
    />
  );
}

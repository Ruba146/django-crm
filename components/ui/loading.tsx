import { cn } from "@/utils/cn";

export interface LoadingProps {
  className?: string;
  label?: string;
}

/**
 * Full-area loading indicator used by Suspense fallbacks.
 * A centered spinner with an optional label.
 */
export function Loading({ className, label = "Loading…" }: LoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

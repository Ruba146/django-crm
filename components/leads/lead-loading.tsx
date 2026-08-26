import { Skeleton, SkeletonRows } from "@/components/ui";

/**
 * Lead loading state — skeleton placeholders used while the list or
 * details panel is loading. Reuses the existing Skeleton primitives.
 */
export function LeadTableLoading() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-full max-w-sm rounded-lg">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <SkeletonRows rows={6} className="p-4" />
      </div>
    </div>
  );
}

/** Skeleton for the details panel while lead data loads. */
export function LeadDetailsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <SkeletonRows rows={4} className="p-4" />
    </div>
  );
}

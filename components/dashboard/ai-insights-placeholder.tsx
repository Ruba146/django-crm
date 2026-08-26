import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

/**
 * AI insights — premium placeholder only.
 * AI functionality will be implemented in a later phase (Phase 10).
 */
export function AIInsightsPlaceholder() {
  return (
    <Card className="relative h-full overflow-hidden">
      {/* Subtle gradient wash for a premium feel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-transparent"
      />
      <CardContent className="relative flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
          <Sparkles className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">
            AI Insights
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            AI Insights will be available in Phase 10.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary-500" aria-hidden="true" />
          Coming soon
        </span>
      </CardContent>
    </Card>
  );
}

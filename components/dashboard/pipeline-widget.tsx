import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { PipelineData } from "@/types";

/**
 * Deterministic color palette derived from the design system tokens.
 * Stage colors fall back to these when the DB color is missing, so future
 * pipeline stages appear automatically without hardcoding.
 */
const STAGE_COLORS = [
  "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300",
  "bg-info/10 text-info",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
  "bg-danger/10 text-danger",
] as const;

/** Pick a stable color for a stage index. */
function stageColor(index: number): string {
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

/**
 * Sales pipeline widget — renders every stage read from the database with
 * the live deal count and total expected value. Purely presentational: the
 * data is passed in as props from a server component.
 */
export function PipelineWidget({
  stages,
  locale = "en",
}: {
  stages: PipelineData[];
  locale?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.dealCount));

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Sales Pipeline</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {stages.reduce((sum, s) => sum + s.dealCount, 0)} deals
        </span>
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <EmptyState
            title="No pipeline stages yet"
            description="Configure pipeline stages to see your sales funnel."
          />
        ) : (
          <div className="space-y-4">
            {stages.map((stage, i) => {
              const width = Math.max(4, Math.round((stage.dealCount / max) * 100));
              return (
                <div key={stage.id ?? i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          stage.color
                            ? "bg-[var(--color-primary-500)]"
                            : stageColor(i)
                        )}
                        aria-hidden="true"
                      />
                      <span className="font-medium">
                        {stage.label ?? "Untitled stage"}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatNumber(stage.dealCount, locale)} ·{" "}
                      {formatNumber(stage.totalValueMinor, locale)}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={stage.dealCount}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-label={`${stage.label}: ${stage.dealCount} deals`}
                  >
                    <div
                      className={cn("h-full rounded-full", stageColor(i))}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

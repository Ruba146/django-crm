import {
  Activity,
  CheckSquare,
  Handshake,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { KpiCard } from "@/types";

interface KpiMeta {
  key: KpiCard["key"];
  label: string;
  icon: LucideIcon;
  tint: string;
}

const KPI_META: KpiMeta[] = [
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300",
  },
  {
    key: "leads",
    label: "Leads",
    icon: UserPlus,
    tint: "bg-info/10 text-info",
  },
  {
    key: "deals",
    label: "Deals",
    icon: Handshake,
    tint: "bg-success/10 text-success",
  },
  {
    key: "activities",
    label: "Activities",
    icon: Activity,
    tint: "bg-warning/10 text-warning",
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    tint: "bg-danger/10 text-danger",
  },
] as const;

/**
 * KPI cards — pure presentational widget. Receives fully-shaped data as
 * props (no database access here). Supports optional trend metadata for
 * future expansion; those fields simply render nothing when undefined.
 */
export function KPICards({
  cards,
  locale = "en",
}: {
  cards: KpiCard[];
  locale?: string;
}) {
  return (
    <section
      aria-label="Key performance indicators"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      {KPI_META.map((meta) => {
        const Icon = meta.icon;
        const card = cards.find((c) => c.key === meta.key);
        const value = card?.value ?? 0;

        return (
          <Card
            key={meta.key}
            className="transition-shadow hover:shadow-pop"
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg",
                    meta.tint
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                {card?.trendDirection && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      card.trendDirection === "up" && "text-success",
                      card.trendDirection === "down" && "text-danger",
                      card.trendDirection === "flat" && "text-muted-foreground"
                    )}
                  >
                    {card.trendDirection === "up" && (
                      <TrendingUp className="size-3.5" aria-hidden="true" />
                    )}
                    {card.trendDirection === "down" && (
                      <TrendingDown className="size-3.5" aria-hidden="true" />
                    )}
                    {card.trendPercentage != null &&
                      `${Math.abs(card.trendPercentage)}%`}
                  </span>
                )}
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatNumber(value, locale)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {meta.label}
                </p>
                {card?.comparisonLabel && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.comparisonLabel}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

import { Card, CardContent } from "@/components/ui";
import {
  Activity,
  BadgeCheck,
  Banknote,
  ListChecks,
  Trophy,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrency, formatNumber } from "@/utils/format";
import type { CustomerStatistics } from "@/types";

/** Single stat tile. */
function StatTile({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <span
          className={
            accent
              ? "text-primary-600 dark:text-primary-400"
              : "text-muted-foreground"
          }
        >
          {icon}
        </span>
        <span className="text-lg font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

/**
 * Customer statistics summary — deals, activities, tasks and revenue.
 * Presentational; reads from a CustomerStatistics object.
 */
export function CustomerStatSummary({
  stats,
  locale = "en",
}: {
  stats: CustomerStatistics;
  locale?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile
        icon={<Banknote className="size-4" />}
        label="Total value"
        value={formatCurrency(stats.totalRevenueMinor, stats.currency_code ?? "SAR", locale)}
        accent
      />
      <StatTile
        icon={<ListChecks className="size-4" />}
        label="Deals"
        value={formatNumber(stats.dealsCount, locale)}
      />
      <StatTile
        icon={<Trophy className="size-4" />}
        label="Won"
        value={formatNumber(stats.wonDeals, locale)}
      />
      <StatTile
        icon={<XCircle className="size-4" />}
        label="Lost"
        value={formatNumber(stats.lostDeals, locale)}
      />
      <StatTile
        icon={<Activity className="size-4" />}
        label="Activities"
        value={formatNumber(stats.activitiesCount, locale)}
      />
      <StatTile
        icon={<BadgeCheck className="size-4" />}
        label="Tasks"
        value={formatNumber(stats.tasksCount, locale)}
      />
    </div>
  );
}

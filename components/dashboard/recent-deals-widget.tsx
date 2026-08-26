import { Handshake } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { RecentDeal } from "@/types";

/**
 * Recent deals widget — latest 5 deals with customer, stage, value and
 * owner. Presentational; data passed in as props.
 */
export function RecentDealsWidget({
  deals,
  locale = "en",
}: {
  deals: RecentDeal[];
  locale?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Handshake
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle>Recent Deals</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">Latest</span>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <EmptyState
            title="No deals yet"
            description="Deals will appear here as you advance opportunities."
          />
        ) : (
          <ul className="divide-y divide-border">
            {deals.map((d) => (
              <li key={d.id ?? d.name} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.customer_name ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      d.stage_color
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                    )}
                  >
                    {d.stage_label ?? "—"}
                  </span>
                  <span className="text-xs font-medium">
                    {formatCurrency(
                      d.expected_value_minor,
                      d.currency_code ?? "SAR",
                      locale
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Avatar
                    name={d.owner_name ?? "?"}
                    size="sm"
                    fallback={(d.owner_name ?? "?")[0]?.toUpperCase()}
                  />
                  <time
                    className="text-[10px] text-muted-foreground"
                    dateTime={d.created_at ?? undefined}
                  >
                    {formatDate(d.created_at, locale)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

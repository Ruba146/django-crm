import { Card, CardContent } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { ReportKpiCard } from "@/types";

interface ReportKpiCardsProps {
  cards: ReportKpiCard[];
  locale?: string;
}

const KPI_META: Record<string, { label: string; icon: string; tint: string }> = {
  customers: { label: "Total Customers", icon: "Users", tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300" },
  leads: { label: "Total Leads", icon: "UserPlus", tint: "bg-info/10 text-info" },
  deals: { label: "Total Deals", icon: "Handshake", tint: "bg-success/10 text-success" },
  open_deals: { label: "Open Deals", icon: "Clock", tint: "bg-warning/10 text-warning" },
  won_deals: { label: "Won Deals", icon: "TrendingUp", tint: "bg-success/10 text-success" },
  lost_deals: { label: "Lost Deals", icon: "TrendingDown", tint: "bg-danger/10 text-danger" },
  revenue: { label: "Total Revenue", icon: "DollarSign", tint: "bg-success/10 text-success" },
  avg_deal: { label: "Average Deal Value", icon: "BarChart2", tint: "bg-info/10 text-info" },
  conversion: { label: "Lead Conversion Rate", icon: "Target", tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300" },
  open_tasks: { label: "Open Tasks", icon: "CheckSquare", tint: "bg-warning/10 text-warning" },
  completed_tasks: { label: "Completed Tasks", icon: "CheckCircle", tint: "bg-success/10 text-success" },
  activities_month: { label: "Activities This Month", icon: "Activity", tint: "bg-info/10 text-info" },
};

export function ReportKpiCards({ cards, locale = "en" }: ReportKpiCardsProps) {
  return (
    <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const meta = KPI_META[card.key] || { label: card.label, icon: "Circle", tint: "bg-muted text-muted-foreground" };
        let displayValue = card.value;
        if (card.format === "percent") {
          displayValue = `${card.value}%`;
        } else if (typeof card.value === "number") {
          displayValue = formatNumber(card.value, locale);
        }

        return (
          <Card key={card.key} className="transition-shadow hover:shadow-pop">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", meta.tint)}>
                  <span className="text-lg font-bold">{meta.icon[0]}</span>
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{displayValue}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{meta.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

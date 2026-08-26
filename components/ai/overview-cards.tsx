"use client";

import { Card, CardContent } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { AiOverviewCard } from "@/types";
import { Users, UserPlus, Handshake, Activity, CheckSquare, DollarSign, Target, TrendingUp } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  UserPlus,
  Handshake,
  Activity,
  CheckSquare,
  DollarSign,
  Target,
  TrendingUp,
};

interface OverviewCardsProps {
  cards: AiOverviewCard[];
  locale?: string;
}

const CARD_META: Record<string, { tint: string }> = {
  customers: { tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300" },
  leads: { tint: "bg-info/10 text-info" },
  deals: { tint: "bg-success/10 text-success" },
  activities: { tint: "bg-info/10 text-info" },
  tasks: { tint: "bg-warning/10 text-warning" },
  revenue: { tint: "bg-success/10 text-success" },
  conversion: { tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300" },
  win_rate: { tint: "bg-success/10 text-success" },
};

export function OverviewCards({ cards, locale = "en" }: OverviewCardsProps) {
  return (
    <section aria-label="AI overview metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const meta = CARD_META[card.key] || { tint: "bg-muted text-muted-foreground" };
        const IconComponent = card.icon ? ICON_MAP[card.icon] : null;
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
                  {IconComponent ? <IconComponent className="size-5" aria-hidden="true" /> : null}
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{displayValue}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

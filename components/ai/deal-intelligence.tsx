"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Target } from "lucide-react";
import Link from "next/link";

interface DealIntelligenceProps {
  priorities: Array<{
    entityId: string;
    entityName: string;
    priority: string;
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    value?: number;
    currency?: string;
  }>;
  riskDeals: Array<{
    id: string;
    name: string | null;
    customerName: string | null;
    stageLabel: string | null;
    expectedValueMinor: number | null;
    daysSinceUpdate: number;
    probabilityPct: number | null;
  }>;
}

export function DealIntelligence({ priorities, riskDeals }: DealIntelligenceProps) {
  const dealPriorities = priorities.filter((p) => p.entityId && p.priorityScore >= 50).slice(0, 5);

  if (dealPriorities.length === 0 && riskDeals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-primary-600" aria-hidden="true" />
          Deal Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dealPriorities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Top Deals Requiring Attention</p>
            {dealPriorities.map((deal) => (
              <div key={deal.entityId} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <Link href={`/deals/${deal.entityId}`} className="text-sm font-medium hover:underline">
                      {deal.entityName}
                    </Link>
                    <p className="text-xs font-medium uppercase tracking-wide">{deal.priority} · Score: {deal.priorityScore}</p>
                    <p className="text-xs text-muted-foreground">{deal.reason}</p>
                    <p className="text-xs font-medium mt-1">Recommended: {deal.recommendedAction}</p>
                  </div>
                  {deal.value != null && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {(deal.value / 100).toFixed(2)} {deal.currency || "SAR"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {riskDeals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Stale Risk Deals</p>
            {riskDeals.slice(0, 5).map((deal) => (
              <div key={deal.id} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <Link href={`/deals/${deal.id}`} className="text-sm font-medium hover:underline">
                      {deal.name || "Untitled Deal"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {deal.customerName} · {deal.stageLabel} · {deal.daysSinceUpdate}d stale
                    </p>
                    {deal.probabilityPct !== null && (
                      <p className="text-xs text-muted-foreground">Probability: {deal.probabilityPct}%</p>
                    )}
                  </div>
                  {deal.expectedValueMinor != null && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {(deal.expectedValueMinor / 100).toFixed(2)} SAR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

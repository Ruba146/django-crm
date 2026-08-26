"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AiRiskDeal } from "@/types";
import { AlertTriangle } from "lucide-react";

interface RiskDealsProps {
  riskDeals: AiRiskDeal[];
}

export function RiskDeals({ riskDeals }: RiskDealsProps) {
  if (riskDeals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No risk deals detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          Risk Deals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left font-medium text-muted-foreground">Deal</th>
                <th className="pb-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="pb-3 text-left font-medium text-muted-foreground">Stage</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Value</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Days Stale</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {riskDeals.map((deal) => (
                <tr key={deal.id} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{deal.name || "Untitled"}</td>
                  <td className="py-3">{deal.customerName || "—"}</td>
                  <td className="py-3">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: deal.stageColor ? `${deal.stageColor}20` : undefined,
                        color: deal.stageColor || undefined,
                      }}
                    >
                      {deal.stageLabel || "—"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {deal.expectedValueMinor != null
                      ? `${(deal.expectedValueMinor / 100).toFixed(2)} ${deal.currencyCode || "SAR"}`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">{deal.daysSinceUpdate}</td>
                  <td className="py-3 text-right">{deal.ownerName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Users } from "lucide-react";
import Link from "next/link";

interface CustomerIntelligenceProps {
  customers: Array<{
    entityId: string;
    entityName: string;
    priority: string;
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    daysSinceActivity?: number | null;
    openDeals?: number;
  }>;
}

export function CustomerIntelligence({ customers }: CustomerIntelligenceProps) {
  if (customers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-info" aria-hidden="true" />
          Customer Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {customers.slice(0, 8).map((customer) => (
          <div key={customer.entityId} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <Link href={`/customers/${customer.entityId}`} className="text-sm font-medium hover:underline">
                  {customer.entityName}
                </Link>
                <p className="text-xs font-medium uppercase tracking-wide">
                  {customer.priority} · Score: {customer.priorityScore}
                </p>
                <p className="text-xs text-muted-foreground">{customer.reason}</p>
                {customer.evidence.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {customer.evidence.slice(0, 3).map((e, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-medium mt-2">Recommended: {customer.recommendedAction}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{customer.openDeals ?? 0} open</p>
                {customer.daysSinceActivity != null && (
                  <p className="text-xs text-muted-foreground">{customer.daysSinceActivity}d inactive</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

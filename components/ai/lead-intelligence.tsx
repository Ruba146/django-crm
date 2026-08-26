"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { UserPlus } from "lucide-react";
import Link from "next/link";

interface LeadIntelligenceProps {
  leads: Array<{
    entityId: string;
    entityName: string;
    priority: string;
    priorityScore: number;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    daysSinceActivity?: number | null;
  }>;
}

export function LeadIntelligence({ leads }: LeadIntelligenceProps) {
  if (leads.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-success" aria-hidden="true" />
          Lead Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {leads.slice(0, 8).map((lead) => (
          <div key={lead.entityId} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <Link href={`/leads/${lead.entityId}`} className="text-sm font-medium hover:underline">
                  {lead.entityName}
                </Link>
                <p className="text-xs font-medium uppercase tracking-wide">
                  {lead.priority} · Score: {lead.priorityScore}
                </p>
                <p className="text-xs text-muted-foreground">{lead.reason}</p>
                {lead.evidence.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {lead.evidence.slice(0, 3).map((e, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-medium mt-2">Recommended: {lead.recommendedAction}</p>
              </div>
              {lead.daysSinceActivity != null && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {lead.daysSinceActivity}d since activity
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

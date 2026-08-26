"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Clock } from "lucide-react";

interface StageBottlenecksProps {
  bottlenecks: Array<{
    id: string;
    stage: string;
    stageColor: string | null;
    totalDeals: number;
    avgDaysInStage: number;
    stalledDeals: number;
    bottleneckScore: number;
    severity: string;
    recommendation: string;
  }>;
}

export function StageBottlenecks({ bottlenecks }: StageBottlenecksProps) {
  if (bottlenecks.length === 0) return null;

  const severityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    info: "text-muted-foreground border-border",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-warning" aria-hidden="true" />
          Stage Bottlenecks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left font-medium text-muted-foreground">Stage</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Deals</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Avg Days</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Stalled</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              {bottlenecks.map((b) => (
                <tr key={b.id} className={`border-b border-border last:border-0 ${severityColors[b.severity] || ""}`}>
                  <td className="py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {b.stageColor && (
                        <span className="inline-block size-2 rounded-full" style={{ backgroundColor: b.stageColor }} />
                      )}
                      {b.stage}
                    </span>
                  </td>
                  <td className="py-3 text-right">{b.totalDeals}</td>
                  <td className="py-3 text-right">{b.avgDaysInStage}</td>
                  <td className="py-3 text-right">{b.stalledDeals}</td>
                  <td className="py-3 text-right font-medium">{b.bottleneckScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bottlenecks.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium">Recommendation:</p>
            <p className="text-xs text-muted-foreground mt-1">{bottlenecks[0].recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { TrendingDown } from "lucide-react";

interface LossPatternsProps {
  patterns: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    evidence: string[];
    sampleSize: number;
    confidence: string;
    businessImpact: string;
  }>;
}

export function LossPatterns({ patterns }: LossPatternsProps) {
  if (patterns.length === 0) return null;

  const severityColors: Record<string, string> = {
    critical: "text-danger border-danger/30 bg-danger/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    info: "text-info border-info/30 bg-info/5",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4 text-danger" aria-hidden="true" />
          Loss Patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {patterns.map((pattern) => (
          <div key={pattern.id} className={`rounded-lg border p-4 ${severityColors[pattern.severity] || severityColors.info}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{pattern.title}</p>
                <span className="text-xs text-muted-foreground capitalize">{pattern.confidence} confidence</span>
              </div>
              <p className="text-xs text-muted-foreground">{pattern.description}</p>
              <div className="space-y-1">
                <p className="text-xs font-medium">Evidence:</p>
                <ul className="space-y-0.5">
                  {pattern.evidence.slice(0, 4).map((e, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground">• {e}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sample size: {pattern.sampleSize}</span>
                <span className="text-muted-foreground">Impact: {pattern.businessImpact}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import type { AiInsight } from "@/types";

interface AiInsightsProps {
  insights: AiInsight[];
}

const SEVERITY_CONFIG: Record<AiInsight["severity"], { icon: React.ComponentType<{ className?: string }>; className: string; label: string }> = {
  info: { icon: Info, className: "bg-info/10 text-info", label: "Info" },
  warning: { icon: AlertTriangle, className: "bg-warning/10 text-warning", label: "Warning" },
  critical: { icon: AlertCircle, className: "bg-danger/10 text-danger", label: "Critical" },
};

export function AiInsights({ insights }: AiInsightsProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No insights available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight) => {
            const config = SEVERITY_CONFIG[insight.severity];
            const Icon = config.icon;
            return (
              <div
                key={insight.id}
                className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", config.className)}>
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", config.className)}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(" ");
}

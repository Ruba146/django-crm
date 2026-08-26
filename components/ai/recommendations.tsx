"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ArrowRight, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AiRecommendation } from "@/types";

interface RecommendationsProps {
  recommendations: AiRecommendation[];
}

const PRIORITY_CONFIG: Record<AiRecommendation["priority"], { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  high: { icon: AlertCircle, className: "bg-danger/10 text-danger" },
  medium: { icon: AlertTriangle, className: "bg-warning/10 text-warning" },
  low: { icon: Info, className: "bg-info/10 text-info" },
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Smart Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recommendations at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const config = PRIORITY_CONFIG[rec.priority];
            const Icon = config.icon;
            return (
              <div
                key={rec.id}
                className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", config.className)}>
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{rec.title}</p>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
                >
                  {rec.actionLabel}
                  <ArrowRight className="size-3" aria-hidden="true" />
                </button>
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

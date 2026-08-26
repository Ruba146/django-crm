import { useMemo } from "react";
import { cn } from "@/utils/cn";

interface RelationshipStrengthBarProps {
  score: number;
  size?: "sm" | "md";
}

export function RelationshipStrengthBar({ score, size = "md" }: RelationshipStrengthBarProps) {
  const color = useMemo(() => {
    if (score >= 80) return "bg-success";
    if (score >= 60) return "bg-info";
    if (score >= 40) return "bg-warning";
    if (score >= 20) return "bg-warning";
    return "bg-danger";
  }, [score]);

  const textColor = useMemo(() => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-info";
    if (score >= 40) return "text-warning";
    if (score >= 20) return "text-warning";
    return "text-danger";
  }, [score]);

  const height = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={cn("flex items-center gap-2", size === "sm" ? "text-xs" : "text-sm")}>
      <div className={cn("flex-1 overflow-hidden rounded-full bg-muted", height)}>
        <div
          className={cn("rounded-full transition-all duration-500", color, height)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("font-semibold tabular-nums", textColor, size === "sm" ? "text-xs" : "text-sm")}>
        {score}
      </span>
    </div>
  );
}

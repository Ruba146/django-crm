"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { NODE_TYPE_CONFIG } from "@/types/graph";

interface GraphTooltipContentProps {
  node: {
    id: string;
    type: string;
    label: string;
    sublabel?: string;
    color?: string;
  };
  edges: Array<{ source: string; target: string; relationship: string }>;
}

export function GraphTooltipContent({ node, edges }: GraphTooltipContentProps) {
  const relationshipCount = useMemo(() => {
    return edges.filter((e) => e.source === `${node.type}:${node.id}` || e.target === `${node.type}:${node.id}`).length;
  }, [edges, node]);

  const config = NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG];

  return (
    <div className="space-y-1.5 min-w-[180px]">
      <div className="flex items-center gap-2">
        <div
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: node.color || config?.color || "#6b7280" }}
        />
        <span className="text-xs font-medium capitalize text-foreground">
          {config?.label || node.type}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">{node.label}</p>
      {node.sublabel && (
        <p className="text-xs text-muted-foreground truncate">{node.sublabel}</p>
      )}
      <div className="flex items-center gap-1.5 pt-1">
        <Badge variant="neutral" className="text-[10px] h-5 px-1.5">
          {relationshipCount} relationship{relationshipCount !== 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}

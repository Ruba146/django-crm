"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus, Network, ChevronRight, X, ChevronDown, GitBranchPlus } from "lucide-react";
import type { GraphEdge, GraphNode } from "@/types/graph";
import { NODE_TYPE_CONFIG } from "@/types/graph";

interface GraphNodeDetailProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: Map<string, GraphNode>;
  expandedNodes: Set<string>;
  expandedGroups: Map<string, Set<string>>;
  explorationPath: string[];
  onFocus: (node: GraphNode) => void;
  onExpand: (node: GraphNode) => void;
  onCollapse: (node: GraphNode) => void;
  onExpandGroup: (nodeKey: string, prefix: string) => void;
  onCollapseGroup: (nodeKey: string, prefix: string) => void;
  onShowMemories: () => void;
  onClearSelection: () => void;
  onSetAsRoot?: (node: GraphNode) => void;
  isRoot?: boolean;
}

export function GraphNodeDetail({
  node,
  edges,
  nodes,
  expandedNodes,
  expandedGroups,
  explorationPath,
  onFocus,
  onExpand,
  onCollapse,
  onExpandGroup,
  onCollapseGroup,
  onShowMemories,
  onClearSelection,
  onSetAsRoot,
  isRoot,
}: GraphNodeDetailProps) {
  const crmHref = useMemo(() => {
    const map: Record<string, string> = {
      customer: "/customers",
      lead: "/leads",
      deal: "/deals",
      task: "/tasks",
      activity: "/activities",
      user: "/settings",
      contact: "/customers",
      memory: "/graph",
    };
    return map[node.type] || "/";
  }, [node.type]);

  const nodeKey = `${node.type}:${node.id}`;
  const isExpanded = expandedNodes.has(nodeKey);

  const allRelatedEdges = useMemo(() => {
    const incoming = edges.filter((e) => e.target === nodeKey);
    const outgoing = edges.filter((e) => e.source === nodeKey);
    return [...incoming, ...outgoing];
  }, [edges, nodeKey]);

  const relationshipCategories = useMemo(() => {
    const categories = new Map<string, { count: number; edges: GraphEdge[]; label: string }>();
    for (const edge of allRelatedEdges) {
      const parts = edge.relationship.split("_");
      const category = parts[0];
      const label = parts.slice(1).join("_").replace(/_/g, " ") || category;
      const existing = categories.get(category) || { count: 0, edges: [] as GraphEdge[], label };
      existing.count += 1;
      existing.edges.push(edge);
      categories.set(category, existing);
    }
    return Array.from(categories.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [allRelatedEdges]);

  const config = NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG];

  const pathNodes = useMemo(() => {
    return explorationPath.map((key) => {
      if (key === nodeKey) return node;
      const found = nodes.get(key);
      if (found) return found;
      return null;
    }).filter(Boolean) as GraphNode[];
  }, [explorationPath, nodeKey, nodes, node]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="p-4 space-y-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: node.color || config?.color || "#6b7280" }}
              />
              <h3 className="text-base font-semibold truncate">{node.label}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {config?.label || node.type}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="size-7" onClick={onClearSelection}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {node.sublabel && (
          <p className="text-xs text-muted-foreground truncate">{node.sublabel}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => window.open(crmHref, "_blank")}
          >
            <ExternalLink className="mr-1.5 size-3" />
            Open in CRM
          </Button>
          {!isRoot && onSetAsRoot && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onSetAsRoot(node)}
            >
              <GitBranchPlus className="mr-1.5 size-3" />
              Set as Root
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onShowMemories}
          >
            <Plus className="mr-1.5 size-3" />
            Memories
          </Button>
        </div>
      </div>

      {pathNodes.length > 1 && (
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Exploration Path</p>
          <div className="flex items-center gap-1 flex-wrap">
            {pathNodes.map((pathNode, idx) => {
              const pathKey = `${pathNode.type}:${pathNode.id}`;
              const isLast = idx === pathNodes.length - 1;
              return (
                <div key={pathKey} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
                  <button
                    onClick={() => onFocus(pathNode)}
                    className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                      isLast
                        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {pathNode.label.length > 16 ? pathNode.label.slice(0, 14) + "…" : pathNode.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Network className="size-3.5" />
            Relationships ({allRelatedEdges.length})
          </div>

          <div className="space-y-1">
            {relationshipCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No relationships found.
              </p>
            ) : (
              relationshipCategories.map((category) => {
                const isGroupExpanded = expandedGroups.get(nodeKey)?.has(category.name);
                const nodeKeyInGroup = (edge: GraphEdge) => edge.source === nodeKey ? edge.target : edge.source;

                return (
                  <div
                    key={category.name}
                    className="rounded-md border border-border"
                  >
                    <button
                      onClick={() => {
                        if (isGroupExpanded) {
                          onCollapseGroup(nodeKey, category.name);
                        } else {
                          onExpandGroup(nodeKey, category.name);
                        }
                      }}
                      className="flex w-full items-center justify-between px-2 py-2 text-start hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isGroupExpanded ? (
                          <ChevronDown className="size-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3 text-muted-foreground" />
                        )}
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          {category.label}
                        </span>
                      </div>
                      <Badge variant="neutral" className="text-[10px] h-4 px-1.5">
                        {category.count}
                      </Badge>
                    </button>
                    {isGroupExpanded && (
                      <div className="space-y-0.5 px-2 pb-2">
                        {category.edges.slice(0, 8).map((edge) => {
                          const neighborKey = nodeKeyInGroup(edge);
                          const [nType, nId] = neighborKey.split(":");
                          const neighbor = nodes.get(neighborKey);
                          const neighborConfig = NODE_TYPE_CONFIG[nType as keyof typeof NODE_TYPE_CONFIG];

                          return (
                            <button
                              key={edge.id}
                              onClick={() => {
                                if (neighborKey && nType && nId && neighbor) {
                                  onFocus(neighbor);
                                }
                              }}
                              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-xs hover:bg-accent transition-colors group"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div
                                  className="size-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: neighborConfig?.color || "#6b7280" }}
                                />
                                <span className="truncate text-foreground group-hover:text-primary-600 transition-colors">
                                  {neighbor ? neighbor.label : nId}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-muted-foreground">
                                  {edge.relationship.split("_").pop()?.toLowerCase()}
                                </span>
                                <ChevronRight className="size-3 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                        {category.edges.length > 8 && (
                          <p className="text-[10px] text-muted-foreground pl-3.5">
                            +{category.edges.length - 8} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border bg-muted/20">
        <div className="flex gap-2">
          {isExpanded ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onCollapse(node)}
            >
              Collapse
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onExpand(node)}
            >
              Expand
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

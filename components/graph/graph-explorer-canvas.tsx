"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GraphEdge, GraphNode } from "@/types/graph";
import { NODE_TYPE_CONFIG } from "@/types/graph";
import { GraphControls } from "./graph-controls";
import type { Dispatch, SetStateAction } from "react";

type EntityKind = "root" | "group" | "lead" | "relationship";

interface VisualNode extends GraphNode {
  kind: EntityKind;
  depth: number;
  parentId: string | null;
}

const ROOT_ID = "all-leads";
const NODE_SIZES = {
  root: 22,
  group: 16,
  lead: 9,
  relationship: 10,
} as const;

const LAYOUT = {
  rootGroupRadius: 240,
  groupLeadRadius: 170,
  relationshipRadius: 120,
  spread: {
    depth0: 3.6,
    depth1: 1.8,
    depth2: 0.9,
  },
};

export interface GraphExplorerCanvasProps {
  onSelectRecord: (result: {
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  }) => void;
  selectedNodeId?: string | null;
  onSelectNode?: Dispatch<SetStateAction<string | null>>;
  onClearSelection?: () => void;
}

function buildGroupKey(kind: "stage" | "source" | "owner", id: string) {
  return `group:${kind}:${id}`;
}

function parseGroupKey(key: string): { kind: "stage" | "source" | "owner"; id: string } | null {
  const match = /^group:(stage|source|owner):(.+)$/.exec(key);
  if (!match) return null;
  return { kind: match[1] as "stage" | "source" | "owner", id: match[2] };
}

export function GraphExplorerCanvas({ onSelectRecord, selectedNodeId: externalSelectedNodeId, onSelectNode, onClearSelection }: GraphExplorerCanvasProps) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showLabels, setShowLabels] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const selectedNodeId = externalSelectedNodeId ?? internalSelectedNodeId;
  const setSelectedNodeId = onSelectNode || setInternalSelectedNodeId;

  const { data: allLeads = [], isLoading: allLeadsLoading } = useQuery({
    queryKey: ["graph-all-leads"],
    queryFn: async () => {
      const res = await fetch("/api/graph/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return (await res.json()) as Array<{ id: string; full_name: string; company_name: string | null }>;
    },
  });

  const { data: aggregates, isLoading: aggregatesLoading } = useQuery({
    queryKey: ["graph-aggregates"],
    queryFn: async () => {
      const res = await fetch("/api/graph/aggregates");
      if (!res.ok) throw new Error("Failed to fetch aggregates");
      return (await res.json()) as {
        totalLeads: number;
        stages: Array<{ id: string; label: string; color: string; count: number }>;
        sources: Array<{ id: string; label: string; color: string; count: number }>;
        owners: Array<{ id: string; name: string; count: number }>;
      };
    },
  });

  const expandedGroupArray = useMemo(() => Array.from(expandedGroups), [expandedGroups]);

  const { data: groupLeadsMap } = useQuery({
    queryKey: ["graph-group-leads", expandedGroupArray],
    queryFn: async () => {
      const results: Record<string, Array<{ id: string; displayName: string; secondaryText?: string }>> = {};
      await Promise.all(
        expandedGroupArray.map(async (groupId) => {
          const parsed = parseGroupKey(groupId);
          if (!parsed) return;

          const params = new URLSearchParams({ category: "leads", pageSize: "100" });
          if (parsed.kind === "stage") params.set("stageId", parsed.id);
          if (parsed.kind === "source") params.set("sourceId", parsed.id);
          if (parsed.kind === "owner") params.set("ownerId", parsed.id);

          const res = await fetch(`/api/graph/records-list?${params.toString()}`);
          if (!res.ok) return;
          const data = await res.json();
          results[groupId] = data.records || [];
        })
      );
      return results;
    },
    enabled: expandedGroupArray.length > 0,
  });

  const { data: selectedLeadDetails } = useQuery({
    queryKey: ["graph-lead-details", selectedNodeId],
    queryFn: async () => {
      if (!selectedNodeId || !selectedNodeId.startsWith("lead:")) return null;
      const id = selectedNodeId.replace("lead:", "");
      const res = await fetch(`/api/graph/record-details?type=lead&id=${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.detail as Record<string, unknown> | null;
    },
    enabled: !!selectedNodeId && selectedNodeId.startsWith("lead:"),
  });

  const { data: leadRelationships } = useQuery({
    queryKey: ["graph-lead-relationships", selectedNodeId],
    queryFn: async () => {
      if (!selectedNodeId || !selectedNodeId.startsWith("lead:")) return null;
      const id = selectedNodeId.replace("lead:", "");
      const res = await fetch(`/api/graph/nodes?type=lead&id=${id}&subgraph=true&depth=1`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        edges: (data.neighbors || []) as GraphEdge[],
        nodes: (data.neighborNodes || []) as GraphNode[],
      };
    },
    enabled: !!selectedNodeId && selectedNodeId.startsWith("lead:"),
  });

  const graphNodes: VisualNode[] = useMemo(() => {
    const nodes: VisualNode[] = [];
    const seen = new Set<string>();

    const addNode = (node: VisualNode) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      nodes.push(node);
    };

    if (aggregates) {
      addNode({
        id: ROOT_ID,
        type: "lead",
        label: "All Leads",
        sublabel: `${aggregates.totalLeads.toLocaleString()} leads`,
        color: "#7c3aed",
        kind: "root",
        depth: 0,
        parentId: null,
      });

      for (const s of aggregates.stages) {
        if (s.count <= 0) continue;
        const id = buildGroupKey("stage", s.id);
        addNode({
          id,
          type: "stage",
          label: s.label || s.id,
          sublabel: `${s.count} leads`,
          color: s.color || "#7c3aed",
          kind: "group",
          depth: 1,
          parentId: ROOT_ID,
          metadata: { groupKind: "stage", groupId: s.id, count: s.count },
        });
      }

      for (const s of aggregates.sources) {
        if (s.count <= 0) continue;
        const id = buildGroupKey("source", s.id);
        addNode({
          id,
          type: "source",
          label: s.label || s.id,
          sublabel: `${s.count} leads`,
          color: s.color || "#059669",
          kind: "group",
          depth: 1,
          parentId: ROOT_ID,
          metadata: { groupKind: "source", groupId: s.id, count: s.count },
        });
      }

      for (const o of aggregates.owners) {
        if (o.count <= 0 || !o.name) continue;
        const id = buildGroupKey("owner", o.id);
        addNode({
          id,
          type: "user",
          label: o.name,
          sublabel: `${o.count} leads`,
          color: "#8b5cf6",
          kind: "group",
          depth: 1,
          parentId: ROOT_ID,
          metadata: { groupKind: "owner", groupId: o.id, count: o.count },
        });
      }
    }

    if (groupLeadsMap) {
      for (const [groupId, records] of Object.entries(groupLeadsMap)) {
        for (const rec of records) {
          const leadId = `lead:${rec.id}`;
          addNode({
            id: leadId,
            type: "lead",
            label: rec.displayName || rec.id,
            sublabel: rec.secondaryText || undefined,
            color: NODE_TYPE_CONFIG.lead.color,
            kind: "lead",
            depth: 2,
            parentId: groupId,
          });
        }
      }
    }

    if (leadRelationships && selectedNodeId) {
      for (const relNode of leadRelationships.nodes) {
        const relKey = `${relNode.type}:${relNode.id}`;
        if (relKey === selectedNodeId.replace("lead:", "")) continue;
        addNode({
          ...relNode,
          kind: "relationship",
          depth: 3,
          parentId: selectedNodeId,
        });
      }
    }

      if (selectedNodeId && selectedNodeId.startsWith("lead:") && allLeads.length > 0) {
        const selectedLead = allLeads.find((l) => `lead:${l.id}` === selectedNodeId);
        if (selectedLead && !seen.has(selectedNodeId)) {
          addNode({
            id: selectedNodeId,
            type: "lead",
            label: selectedLead.full_name || selectedLead.id,
            sublabel: selectedLead.company_name || undefined,
            color: NODE_TYPE_CONFIG.lead.color,
            kind: "lead",
            depth: selectedNodeId.startsWith("lead:") ? 2 : 3,
            parentId: selectedNodeId && expandedGroups.has(selectedNodeId) ? null : ROOT_ID,
          });
        }
      }

    return nodes;
  }, [aggregates, groupLeadsMap, leadRelationships, selectedNodeId, allLeads, expandedGroups]);

  const graphEdges: GraphEdge[] = useMemo(() => {
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    const addEdge = (edge: GraphEdge) => {
      if (seen.has(edge.id)) return;
      seen.add(edge.id);
      edges.push(edge);
    };

    for (const node of graphNodes) {
      if (node.kind === "root" || node.depth === 1) {
        if (node.parentId === ROOT_ID) {
          addEdge({ id: `${ROOT_ID}->${node.id}`, source: ROOT_ID, target: node.id, relationship: "HAS_GROUP" });
        }
      }
      if (node.kind === "lead" && node.depth === 2 && node.parentId && node.parentId !== ROOT_ID) {
        addEdge({ id: `${node.parentId}->${node.id}`, source: node.parentId, target: node.id, relationship: "HAS_LEAD" });
      }
    }

    if (leadRelationships && selectedNodeId) {
      for (const edge of leadRelationships.edges) {
        addEdge(edge);
      }
    }

    return edges;
  }, [graphNodes, leadRelationships, selectedNodeId]);

  const nodePositions = useMemo(() => {
    if (graphNodes.length === 0) return new Map<string, { x: number; y: number }>();

    const positions = new Map<string, { x: number; y: number }>();
    const childrenByParent = new Map<string | null, VisualNode[]>();

    for (const node of graphNodes) {
      if (node.depth === 0) continue;
      const parentId = node.parentId || null;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node);
    }

    for (const [, children] of childrenByParent) {
      children.sort((a, b) => String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" }));
    }

    const root = graphNodes.find((n) => n.depth === 0);
    if (root) {
      positions.set(root.id, { x: 0, y: 0 });
    }

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    function place(parentId: string | null, depth: number) {
      const parentPos = parentId ? positions.get(parentId) : { x: 0, y: 0 };
      if (!parentPos) return;

      const children = childrenByParent.get(parentId) || [];
      if (children.length === 0) return;

      const baseRadius =
        depth === 0 ? LAYOUT.rootGroupRadius : depth === 1 ? LAYOUT.groupLeadRadius : LAYOUT.relationshipRadius;
      const spread = depth === 0 ? LAYOUT.spread.depth0 : depth === 1 ? LAYOUT.spread.depth1 : LAYOUT.spread.depth2;
      const maxRadius = baseRadius + children.length * spread;

      children.forEach((child, i) => {
        const angle = i * goldenAngle;
        const r = Math.sqrt((i + 1) / children.length) * maxRadius;
        positions.set(child.id, {
          x: parentPos.x + r * Math.cos(angle),
          y: parentPos.y + r * Math.sin(angle),
        });
        place(child.id, depth + 1);
      });
    }

    const rootChildren = childrenByParent.get(ROOT_ID) || [];
    if (rootChildren.length > 0) {
      place(ROOT_ID, 0);
    }

    return positions;
  }, [graphNodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, VisualNode>();
    for (const n of graphNodes) map.set(n.id, n);
    return map;
  }, [graphNodes]);

  const selectedLeadNode = selectedNodeId && selectedNodeId.startsWith("lead:") ? nodeMap.get(selectedNodeId) : null;
  const selectedLeadPos = selectedNodeId ? nodePositions.get(selectedNodeId) : null;

  const handleFitView = useCallback(() => {
    if (nodePositions.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of graphNodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;
      const r = NODE_SIZES[node.kind] || NODE_SIZES.lead;
      minX = Math.min(minX, pos.x - r);
      minY = Math.min(minY, pos.y - r);
      maxX = Math.max(maxX, pos.x + r);
      maxY = Math.max(maxY, pos.y + r);
    }

    const padding = 80;
    const availableWidth = canvasSize.width - padding * 2;
    const availableHeight = canvasSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / (maxX - minX);
    const scaleY = availableHeight / (maxY - minY);
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    setCamera({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale,
    });
  }, [nodePositions, canvasSize, graphNodes]);

  const handleResetView = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
    setExpandedGroups(new Set());
    setSelectedNodeId(null);
  }, []);

  const handleCenterSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const pos = nodePositions.get(selectedNodeId);
    if (pos) {
      setCamera({ x: pos.x, y: pos.y, scale: 1.2 });
    }
  }, [selectedNodeId, nodePositions]);

  useEffect(() => {
    if (nodePositions.size > 0 && canvasSize.width > 0 && canvasSize.height > 0) {
      const id = requestAnimationFrame(() => {
        handleFitView();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [nodePositions.size, canvasSize.width, canvasSize.height, handleFitView]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (nodeId === ROOT_ID) {
        setExpandedGroups(new Set());
        setSelectedNodeId(null);
        return;
      }

      const parsed = parseGroupKey(nodeId);
      if (parsed) {
        setSelectedNodeId(null);
        setExpandedGroups((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
        return;
      }

      if (nodeId.startsWith("lead:")) {
        setSelectedNodeId((prev) => {
          if (prev === nodeId) return null;
          return nodeId;
        });
        return;
      }
    },
    [setSelectedNodeId]
  );

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.tagName === "svg" || target.classList.contains("graph-bg")) {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.max(width, 400), height: Math.max(height, 300) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setCamera((prev) => ({
        ...prev,
        scale: Math.min(Math.max(prev.scale * delta, 0.2), 3),
      }));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        const target = e.target as HTMLElement;
        if (target === containerRef.current || target.tagName === "svg" || target.classList.contains("graph-bg")) {
          setIsDragging(true);
          dragStart.current = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
        }
      }
    },
    [camera]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setCamera((prev) => ({
          ...prev,
          x: dragStart.current.camX - dx / prev.scale,
          y: dragStart.current.camY - dy / prev.scale,
        }));
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => !prev);
  }, []);

  const handleToggleLayout = useCallback(() => {
    // Leads intelligence explorer uses a deterministic hierarchical layout
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const worldToScreen = useCallback(
    (wx: number, wy: number) => {
      return {
        x: (wx - camera.x) * camera.scale + canvasSize.width / 2,
        y: (wy - camera.y) * camera.scale + canvasSize.height / 2,
      };
    },
    [camera, canvasSize]
  );

  const isDimmed = useCallback(
    (nodeId: string) => {
      if (!selectedNodeId && !hoveredNodeId) return false;
      if (nodeId === selectedNodeId || nodeId === hoveredNodeId) return false;
      if (nodeId === ROOT_ID) return false;

      if (selectedNodeId) {
        const selectedNode = nodeMap.get(selectedNodeId);
        if (selectedNode && selectedNode.kind === "lead") {
          const relatedIds = new Set<string>();
          relatedIds.add(selectedNodeId);
          if (leadRelationships) {
            for (const edge of leadRelationships.edges) {
              if (edge.source === selectedNodeId) relatedIds.add(edge.target);
              if (edge.target === selectedNodeId) relatedIds.add(edge.source);
            }
          }
          if (relatedIds.has(nodeId)) return false;
          return true;
        }
      }

      if (hoveredNodeId) {
        const hoveredNode = nodeMap.get(hoveredNodeId);
        if (hoveredNode && hoveredNode.kind === "lead") {
          const relatedIds = new Set<string>();
          relatedIds.add(hoveredNodeId);
          if (leadRelationships) {
            for (const edge of leadRelationships.edges) {
              if (edge.source === hoveredNodeId) relatedIds.add(edge.target);
              if (edge.target === hoveredNodeId) relatedIds.add(edge.source);
            }
          }
          if (relatedIds.has(nodeId)) return false;
          return true;
        }
      }

      return false;
    },
    [selectedNodeId, hoveredNodeId, nodeMap, leadRelationships]
  );

  const viewBox = `${camera.x - canvasSize.width / camera.scale / 2} ${camera.y - canvasSize.height / camera.scale / 2} ${canvasSize.width / camera.scale} ${canvasSize.height / camera.scale}`;

  let detailsStyle: React.CSSProperties = { display: "none" };
  if (selectedLeadNode && selectedLeadPos) {
    const screen = worldToScreen(selectedLeadPos.x, selectedLeadPos.y);
    const panelWidth = 280;
    let left = screen.x - panelWidth / 2;
    let top = screen.y + NODE_SIZES.lead * camera.scale + 10;

    left = Math.max(8, Math.min(canvasSize.width - panelWidth - 8, left));
    if (top + 170 > canvasSize.height) {
      top = screen.y - NODE_SIZES.lead * camera.scale - 170;
    }
    top = Math.max(8, top);

    detailsStyle = { left, top, display: "block" };
  }

  const isLoading = aggregatesLoading || allLeadsLoading;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative bg-white overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : (
          <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.3" />
              </filter>
              <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#7c3aed" floodOpacity="0.25" />
              </filter>
              <linearGradient id="root-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>

            {graphEdges.map((edge) => {
              const sourcePos = nodePositions.get(edge.source);
              const targetPos = nodePositions.get(edge.target);
              if (!sourcePos || !targetPos) return null;

              const isHighlighted = selectedNodeId
                ? edge.source === selectedNodeId || edge.target === selectedNodeId
                : hoveredNodeId
                  ? edge.source === hoveredNodeId || edge.target === hoveredNodeId
                  : true;

              const dimmed = (selectedNodeId || hoveredNodeId) && !isHighlighted;

              return (
                <g key={edge.id}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isHighlighted ? "#7c3aed" : "#e4e4e7"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    opacity={dimmed ? 0.1 : isHighlighted ? 0.6 : 0.3}
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}

            {graphNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const isSelected = node.id === selectedNodeId;
              const isHovered = node.id === hoveredNodeId;
              const dimmed = isDimmed(node.id);
              const size = NODE_SIZES[node.kind] || NODE_SIZES.lead;
              const radius = isSelected ? size + 3 : isHovered ? size + 1 : size;

              if (node.kind === "root") {
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    <circle r={radius} fill="url(#root-gradient)" filter="url(#glow-purple)" opacity={dimmed ? 0.4 : 1} />
                    <text textAnchor="middle" dy="-0.2em" className="text-[10px] font-semibold pointer-events-none select-none" fill="#ffffff">
                      {node.label}
                    </text>
                    {node.sublabel && (
                      <text textAnchor="middle" dy="1.2em" className="text-[8px] pointer-events-none select-none" fill="#e9d5ff">
                        {node.sublabel}
                      </text>
                    )}
                  </g>
                );
              }

              if (node.kind === "group") {
                const parsed = parseGroupKey(node.id);
                const isExpanded = parsed ? expandedGroups.has(node.id) : false;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    <circle
                      r={radius}
                      fill={node.color}
                      opacity={dimmed ? 0.3 : 0.9}
                      filter="url(#shadow-sm)"
                      className="transition-all duration-200"
                    />
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      className="text-[10px] font-medium pointer-events-none select-none"
                      fill="#ffffff"
                    >
                      {node.label && node.label.length > 10 ? node.label.slice(0, 9) + "…" : node.label || ""}
                    </text>
                    <text
                      textAnchor="middle"
                      dy={radius + 12}
                      className="text-[8px] pointer-events-none select-none"
                      fill={dimmed ? "#64748b" : "#ffffff"}
                    >
                      {node.sublabel}
                    </text>
                    <g transform={`translate(${radius + 6}, ${-radius + 6})`}>
                      <circle r="8" fill="#fff" opacity={dimmed ? 0.3 : 0.9} />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        className="text-[8px] pointer-events-none select-none"
                        fill={node.color}
                      >
                        {isExpanded ? "−" : "+"}
                      </text>
                    </g>
                  </g>
                );
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                  className="cursor-pointer transition-all duration-200"
                >
                  <title>{node.label}{node.sublabel ? ` (${node.sublabel})` : ""}</title>
                  <circle
                    r={radius}
                    fill={isSelected ? "#7c3aed" : "#ffffff"}
                    stroke={isSelected ? "#7c3aed" : "#d4d4d8"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    filter={isSelected ? "url(#glow-purple)" : "url(#shadow-sm)"}
                    opacity={dimmed ? 0.3 : 1}
                    className="transition-all duration-200"
                  />
                  {(showLabels || isSelected || isHovered) && (
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      className="text-[7px] font-medium pointer-events-none select-none"
                      fill={isSelected ? "#ffffff" : "#18181b"}
                    >
                      {node.label && node.label.length > 10 ? node.label.slice(0, 9) + "…" : node.label || ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {selectedLeadNode && selectedLeadPos && (
          <div
            className="absolute z-20 w-[280px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
            style={detailsStyle}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Selected Lead</p>
                <p className="text-sm font-semibold text-slate-100 truncate">{selectedLeadNode.label}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    onSelectRecord({
                      entityType: selectedLeadNode.type,
                      entityId: selectedLeadNode.id.replace("lead:", ""),
                      displayName: selectedLeadNode.label,
                    })
                  }
                  className="text-[10px] px-2 py-1 rounded-md bg-purple-500/10 text-purple-300 hover:bg-purple-500/15 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[10px] px-2 py-1 rounded-md bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            {selectedLeadDetails && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                {(selectedLeadDetails as Record<string, string | number | boolean | null>).company_name && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Company:</span>{" "}
                    <span className="text-slate-300">
                      {String((selectedLeadDetails as Record<string, string | number | boolean | null>).company_name)}
                    </span>
                  </div>
                )}
                {(selectedLeadDetails as Record<string, string | number | boolean | null>).stage_label && (
                  <div>
                    <span className="text-slate-500">Stage:</span>{" "}
                    <span className="text-slate-300">
                      {String((selectedLeadDetails as Record<string, string | number | boolean | null>).stage_label)}
                    </span>
                  </div>
                )}
                {(selectedLeadDetails as Record<string, string | number | boolean | null>).source_label && (
                  <div>
                    <span className="text-slate-500">Source:</span>{" "}
                    <span className="text-slate-300">
                      {String((selectedLeadDetails as Record<string, string | number | boolean | null>).source_label)}
                    </span>
                  </div>
                )}
                {(selectedLeadDetails as Record<string, string | number | boolean | null>).owner_name && (
                  <div>
                    <span className="text-slate-500">Owner:</span>{" "}
                    <span className="text-slate-300">
                      {String((selectedLeadDetails as Record<string, string | number | boolean | null>).owner_name)}
                    </span>
                  </div>
                )}
                {(selectedLeadDetails as Record<string, string | number | boolean | null>).created_at && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Created:</span>{" "}
                    <span className="text-slate-300">
                      {String((selectedLeadDetails as Record<string, string | number | boolean | null>).created_at)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-10">
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-slate-500">
            {graphNodes.length} nodes · {graphEdges.length} edges
          </div>
        </div>

        <div className="absolute top-3 end-3 z-10 flex flex-col gap-1.5">
          <GraphControls
            zoom={camera.scale}
            onZoomIn={() => setCamera((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
            onZoomOut={() => setCamera((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.2) }))}
            onFitView={handleFitView}
            onReset={handleResetView}
            onCenterSelected={handleCenterSelected}
            onExpandSelected={() => {}}
            onCollapseSelected={() => {}}
            onToggleLabels={handleToggleLabels}
            onToggleLayout={handleToggleLayout}
            showLabels={showLabels}
            layoutType="force"
            selectedNode={selectedNodeId ? { type: "lead", id: selectedNodeId.replace("lead:", "") } : null}
            canExpand={false}
            canCollapse={false}
            onClearSelection={handleClearSelection}
          />
        </div>
      </div>
    </div>
  );
}

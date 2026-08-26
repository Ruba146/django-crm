"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GraphEdge, GraphNode } from "@/types/graph";
import { NODE_TYPE_CONFIG } from "@/types/graph";
import { GraphControls } from "./graph-controls";
import type { Dispatch, SetStateAction } from "react";

type EntityKind = "root" | "group" | "collection" | "lead" | "relationship";

interface VisualNode extends GraphNode {
  kind: EntityKind;
  depth: number;
  parentId: string | null;
}

const ROOT_ID = "all-leads";

const LAYOUT = {
  rootRadius: 100,
  categoryWidth: 260,
  categoryHeight: 80,
  categoryRx: 8,
  categoryGapX: 300,
  categoryGapY: 40,
  categoryStartY: 200,
  collectionWidth: 520,
  collectionHeaderHeight: 44,
  collectionRx: 6,
  collectionHeaderGap: 16,
  leadWidth: 120,
  leadHeight: 48,
  leadRx: 6,
  leadGapX: 10,
  leadGapY: 10,
  leadsPerRow: 4,
};

export interface GraphExplorerCanvasProps {
  onSelectRecord: (result: { entityType: string; entityId: string; displayName: string; secondaryText?: string }) => void;
  selectedNodeId?: string | null;
  onSelectNode?: Dispatch<SetStateAction<string | null>>;
  expandedCategories: Set<string>;
  onToggleCategory: (categoryId: string) => void;
  onClearSelection?: () => void;
}

export function GraphExplorerCanvas({
  onSelectRecord,
  selectedNodeId: externalSelectedNodeId,
  onSelectNode,
  expandedCategories,
  onToggleCategory,
  onClearSelection,
}: GraphExplorerCanvasProps) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showLabels, setShowLabels] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const selectedNodeId = externalSelectedNodeId ?? internalSelectedNodeId;
  const setSelectedNodeId = onSelectNode || setInternalSelectedNodeId;

  const { data: leadCategories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["graph-lead-categories"],
    queryFn: async () => {
      const res = await fetch("/api/graph/lead-categories");
      if (!res.ok) throw new Error("Failed to fetch lead categories");
      return (await res.json()) as Array<{ id: string; label: string; color: string; count: number }>;
    },
  });

  const expandedCategoryArray = useMemo(() => Array.from(expandedCategories), [expandedCategories]);

  const { data: categoryLeadsMap = {} } = useQuery({
    queryKey: ["graph-category-leads", expandedCategoryArray],
    queryFn: async () => {
      const results: Record<string, { records: Array<{ entityType: string; entityId: string; displayName: string; secondaryText?: string }>; total: number; page: number; totalPages: number }> = {};
      await Promise.all(
        expandedCategoryArray.map(async (fullCategoryId) => {
          const rawCategoryId = fullCategoryId.replace("category:", "");
          const params = new URLSearchParams({ categoryId: rawCategoryId, all: "true" });
          const res = await fetch(`/api/graph/category-leads?${params.toString()}`);
          if (!res.ok) return;
          const data = await res.json();
          results[fullCategoryId] = data;
        })
      );
      return results;
    },
    enabled: expandedCategoryArray.length > 0,
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

  const totalLeads = useMemo(() => {
    return leadCategories.reduce((sum, cat) => sum + cat.count, 0);
  }, [leadCategories]);

  const visibleLeadCount = useMemo(() => {
    let count = 0;
    for (const fullCategoryId of expandedCategoryArray) {
      const leadsData = categoryLeadsMap[fullCategoryId];
      if (leadsData) {
        count += leadsData.records.length;
      }
    }
    return count;
  }, [expandedCategoryArray, categoryLeadsMap]);

  const graphNodes: VisualNode[] = useMemo(() => {
    const nodes: VisualNode[] = [];
    const seen = new Set<string>();

    const addNode = (node: VisualNode) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      nodes.push(node);
    };

    addNode({
      id: ROOT_ID,
      type: "lead",
      label: "All Leads",
      sublabel: `${totalLeads.toLocaleString()} leads`,
      color: "#7c3aed",
      kind: "root",
      depth: 0,
      parentId: null,
    });

    for (const cat of leadCategories) {
      if (cat.count <= 0) continue;
      const categoryId = `category:${cat.id}`;
      addNode({
        id: categoryId,
        type: "lead",
        label: cat.label,
        sublabel: `${cat.count.toLocaleString()} leads`,
        color: cat.color,
        kind: "group",
        depth: 1,
        parentId: ROOT_ID,
      });

      if (expandedCategories.has(categoryId)) {
        const leadsData = categoryLeadsMap[`category:${cat.id}`];
        addNode({
          id: `collection:${cat.id}`,
          type: "lead",
          label: cat.label,
          sublabel: `${cat.count.toLocaleString()} total`,
          color: cat.color,
          kind: "collection",
          depth: 2,
          parentId: categoryId,
        });

        if (leadsData) {
          for (const rec of leadsData.records) {
            const leadId = `lead:${rec.entityId}`;
            addNode({
              id: leadId,
              type: "lead",
              label: rec.displayName || rec.entityId,
              sublabel: rec.secondaryText || undefined,
              color: NODE_TYPE_CONFIG.lead.color,
              kind: "lead",
              depth: 3,
              parentId: `collection:${cat.id}`,
            });
          }
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
          depth: 4,
          parentId: selectedNodeId,
        });
      }
    }

    return nodes;
  }, [leadCategories, expandedCategories, categoryLeadsMap, leadRelationships, selectedNodeId, totalLeads]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, VisualNode>();
    for (const n of graphNodes) map.set(n.id, n);
    return map;
  }, [graphNodes]);

  const nodePositions = useMemo(() => {
    if (graphNodes.length === 0) return new Map<string, { x: number; y: number; width?: number; height?: number }>();

    const positions = new Map<string, { x: number; y: number; width?: number; height?: number }>();
    const categoryRowMap: Record<string, number> = {};
    const categoryLeadIds: Record<string, string[]> = {};

    const TOP_ROW_Y = -250;
    const BOTTOM_ROW_Y = 250;
    const ROOT_RADIUS = LAYOUT.rootRadius;

    positions.set(ROOT_ID, { x: 0, y: 0, width: ROOT_RADIUS * 2, height: ROOT_RADIUS * 2 });

    const categoriesPerRow = 5;
    const totalCategoryWidth = categoriesPerRow * LAYOUT.categoryWidth + (categoriesPerRow - 1) * LAYOUT.categoryGapX;
    const categoryStartX = -totalCategoryWidth / 2 + LAYOUT.categoryWidth / 2;

    const visibleCategories = leadCategories.filter((cat) => cat.count > 0);
    const categoryIndexMap: Record<string, number> = {};
    leadCategories.forEach((cat, i) => {
      categoryIndexMap[cat.id] = i;
    });

    visibleCategories.forEach((cat) => {
      const originalIndex = categoryIndexMap[cat.id];
      const row = originalIndex < 5 ? 0 : 1;
      const col = originalIndex % categoriesPerRow;
      const x = categoryStartX + col * (LAYOUT.categoryWidth + LAYOUT.categoryGapX);
      const y = row === 0 ? TOP_ROW_Y : BOTTOM_ROW_Y;
      positions.set(`category:${cat.id}`, { x, y, width: LAYOUT.categoryWidth, height: LAYOUT.categoryHeight });
      categoryRowMap[cat.id] = row;
      categoryLeadIds[cat.id] = [];
    });

    const topExpandedBounds: Array<{ top: number; categoryId: string }> = [];
    const bottomExpandedBounds: Array<{ bottom: number; categoryId: string }> = [];

    for (const cat of leadCategories) {
      const categoryId = `category:${cat.id}`;
      const categoryPos = positions.get(categoryId);
      if (!categoryPos) continue;

      if (expandedCategories.has(categoryId)) {
        const leadsData = categoryLeadsMap[categoryId];
        if (!leadsData) continue;

        const allLeads = leadsData.records;
        const numRows = Math.ceil(allLeads.length / LAYOUT.leadsPerRow) || 1;
        const collectionHeight = LAYOUT.collectionHeaderHeight + numRows * (LAYOUT.leadHeight + LAYOUT.leadGapY) + 20;

        const collectionX = categoryPos.x;
        let collectionY: number;

        if (categoryPos.y < 0) {
          collectionY = categoryPos.y - LAYOUT.categoryHeight / 2 - LAYOUT.collectionHeaderGap - collectionHeight / 2;
        } else {
          collectionY = categoryPos.y + LAYOUT.categoryHeight / 2 + LAYOUT.collectionHeaderGap + collectionHeight / 2;
        }

        const panelTop = collectionY - collectionHeight / 2;
        const panelBottom = collectionY + collectionHeight / 2;

        positions.set(`collection:${cat.id}`, { x: collectionX, y: collectionY, width: LAYOUT.collectionWidth, height: collectionHeight });

        const leadIds: string[] = [];
        allLeads.forEach((lead, i) => {
          const leadRow = Math.floor(i / LAYOUT.leadsPerRow);
          const col = i % LAYOUT.leadsPerRow;
          const leadsInRow = Math.min(LAYOUT.leadsPerRow, allLeads.length - leadRow * LAYOUT.leadsPerRow);
          const rowWidth = leadsInRow * LAYOUT.leadWidth + (leadsInRow - 1) * LAYOUT.leadGapX;
          const startX = collectionX - rowWidth / 2 + LAYOUT.leadWidth / 2;

          const leadX = startX + col * (LAYOUT.leadWidth + LAYOUT.leadGapX);
          const leadY = collectionY + LAYOUT.collectionHeaderHeight / 2 + 10 + leadRow * (LAYOUT.leadHeight + LAYOUT.leadGapY) + LAYOUT.leadHeight / 2;
          positions.set(`lead:${lead.entityId}`, { x: leadX, y: leadY, width: LAYOUT.leadWidth, height: LAYOUT.leadHeight });
          leadIds.push(lead.entityId);
        });
        categoryLeadIds[cat.id] = leadIds;

        if (categoryPos.y < 0) {
          topExpandedBounds.push({ top: panelTop, categoryId });
        } else {
          bottomExpandedBounds.push({ bottom: panelBottom, categoryId });
        }
      }
    }

    const rootTop = -ROOT_RADIUS;
    const rootBottom = ROOT_RADIUS;
    const gap = 40;

    let topRowShift = 0;
    for (const bound of topExpandedBounds) {
      if (bound.top < rootTop - gap) {
        topRowShift = Math.max(topRowShift, rootTop - gap - bound.top);
      }
    }

    let bottomRowShift = 0;
    for (const bound of bottomExpandedBounds) {
      if (bound.bottom > rootBottom + gap) {
        bottomRowShift = Math.max(bottomRowShift, bound.bottom - (rootBottom + gap));
      }
    }

    const shiftRow = (row: number, deltaY: number) => {
      for (const cat of leadCategories) {
        if (categoryRowMap[cat.id] !== row) continue;
        const categoryId = `category:${cat.id}`;
        const pos = positions.get(categoryId);
        if (!pos) continue;

        const newY = pos.y + deltaY;
        positions.set(categoryId, { ...pos, y: newY });

        const collectionPos = positions.get(`collection:${cat.id}`);
        if (collectionPos && expandedCategories.has(categoryId)) {
          positions.set(`collection:${cat.id}`, { ...collectionPos, y: collectionPos.y + deltaY });

          const leadIds = categoryLeadIds[cat.id] || [];
          for (const leadId of leadIds) {
            const leadPos = positions.get(`lead:${leadId}`);
            if (leadPos) {
              positions.set(`lead:${leadId}`, { ...leadPos, y: leadPos.y + deltaY });
            }
          }
        }
      }
    };

    if (topRowShift > 0) shiftRow(0, -topRowShift);
    if (bottomRowShift > 0) shiftRow(1, bottomRowShift);

    if (leadRelationships && selectedNodeId) {
      const selectedPos = positions.get(selectedNodeId);
      if (selectedPos) {
        leadRelationships.nodes.forEach((relNode, i) => {
          const relKey = `${relNode.type}:${relNode.id}`;
          if (relKey === selectedNodeId.replace("lead:", "")) return;
          positions.set(relKey, {
            x: selectedPos.x + 180 + (i % 3) * 140,
            y: selectedPos.y + Math.floor(i / 3) * 70 - 35,
            width: 120,
            height: 50,
          });
        });
      }
    }

    return positions;
  }, [graphNodes, leadCategories, expandedCategories, categoryLeadsMap, leadRelationships, selectedNodeId]);

  const graphEdges: GraphEdge[] = useMemo(() => {
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    const addEdge = (edge: GraphEdge) => {
      if (seen.has(edge.id)) return;
      seen.add(edge.id);
      edges.push(edge);
    };

    for (const node of graphNodes) {
      if (node.kind === "group" && node.parentId === ROOT_ID) {
        addEdge({ id: `${ROOT_ID}->${node.id}`, source: ROOT_ID, target: node.id, relationship: "HAS_CATEGORY" });
      }
      if (node.kind === "collection" && node.parentId) {
        addEdge({ id: `${node.parentId}->${node.id}`, source: node.parentId, target: node.id, relationship: "HAS_COLLECTION" });
      }
      if (node.kind === "lead" && node.depth === 3 && node.parentId) {
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

  const handleFitView = useCallback(() => {
    if (nodePositions.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [, pos] of nodePositions) {
      const padding = 15;
      minX = Math.min(minX, pos.x - (pos.width || 0) / 2 - padding);
      minY = Math.min(minY, pos.y - (pos.height || 0) / 2 - padding);
      maxX = Math.max(maxX, pos.x + (pos.width || 0) / 2 + padding);
      maxY = Math.max(maxY, pos.y + (pos.height || 0) / 2 + padding);
    }

    const padding = 40;
    const availableWidth = canvasSize.width - padding * 2;
    const availableHeight = canvasSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / (maxX - minX);
    const scaleY = availableHeight / (maxY - minY);
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 2.0);

    setCamera({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      scale,
    });
  }, [nodePositions, canvasSize]);

  const handleResetView = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
    onToggleCategory("__reset__");
    setSelectedNodeId(null);
  }, [setSelectedNodeId, onToggleCategory]);

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
        onToggleCategory("__reset__");
        setSelectedNodeId(null);
        onClearSelection?.();
        return;
      }

      if (nodeId.startsWith("category:")) {
        setSelectedNodeId(null);
        onToggleCategory(nodeId);
        return;
      }

      if (nodeId.startsWith("lead:")) {
        const node = nodeMap.get(nodeId);
        if (node) {
          onSelectRecord({
            entityType: "lead",
            entityId: node.id.replace("lead:", ""),
            displayName: node.label,
            secondaryText: node.sublabel || undefined,
          });
        }
        setSelectedNodeId((prev) => {
          if (prev === nodeId) return null;
          return nodeId;
        });
        return;
      }

      if (nodeId.startsWith("collection:")) {
        return;
      }
    },
    [setSelectedNodeId, onToggleCategory, onSelectRecord, onClearSelection, nodeMap]
  );

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.tagName === "svg" || target.classList.contains("graph-bg")) {
      setSelectedNodeId(null);
      onClearSelection?.();
    }
  }, [setSelectedNodeId, onClearSelection]);

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

  const isDimmed = useCallback(
    (nodeId: string) => {
      if (!selectedNodeId && !hoveredNodeId) return false;
      if (nodeId === ROOT_ID) return false;

      const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;
      const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) : null;

      if (selectedNode && selectedNode.kind === "lead") {
        if (nodeId === selectedNodeId) return false;

        let parentId = selectedNode.parentId;
        while (parentId) {
          if (nodeId === parentId) return false;
          const parent = nodeMap.get(parentId);
          parentId = parent?.parentId || null;
        }

        if (leadRelationships) {
          for (const edge of leadRelationships.edges) {
            if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
              if (nodeId === edge.source || nodeId === edge.target) return false;
            }
          }
        }

        return true;
      }

      if (hoveredNode) {
        if (nodeId === hoveredNodeId) return false;

        const isChild = nodeMap.get(nodeId)?.parentId === hoveredNodeId;
        if (isChild) return false;

        let parentId = hoveredNode.parentId;
        while (parentId) {
          if (nodeId === parentId) return false;
          const parent = nodeMap.get(parentId);
          parentId = parent?.parentId || null;
        }

        return true;
      }

      return false;
    },
    [selectedNodeId, hoveredNodeId, nodeMap, leadRelationships]
  );

  const viewBox = `${camera.x - canvasSize.width / camera.scale / 2} ${camera.y - canvasSize.height / camera.scale / 2} ${canvasSize.width / camera.scale} ${canvasSize.height / camera.scale}`;

  const isLoading = categoriesLoading;

  return (
    <div className="flex flex-1 min-h-0 flex-col w-full min-w-0">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative bg-white overflow-hidden cursor-grab active:cursor-grabbing w-full min-w-0"
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
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#7c3aed" />
              </marker>
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
                    markerEnd="url(#arrowhead)"
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}

            {graphNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const isSelected = node.id === selectedNodeId;
              const dimmed = isDimmed(node.id);

              if (node.kind === "root") {
                const radius = LAYOUT.rootRadius;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    <circle r={radius} fill="url(#root-gradient)" filter="url(#glow-purple)" opacity={dimmed ? 0.4 : 1} />
                    <text textAnchor="middle" dy="-0.3em" className="text-sm font-bold pointer-events-none select-none" fill="#ffffff">
                      {node.label}
                    </text>
                    {node.sublabel && (
                      <text textAnchor="middle" dy="1.4em" className="text-xs pointer-events-none select-none" fill="#e9d5ff">
                        {node.sublabel}
                      </text>
                    )}
                  </g>
                );
              }

              if (node.kind === "group") {
                const isExpanded = expandedCategories.has(node.id);
                const w = LAYOUT.categoryWidth;
                const h = LAYOUT.categoryHeight;
                const rx = LAYOUT.categoryRx;
                const label = node.label || "";

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  >
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={rx}
                      fill={node.color}
                      opacity={dimmed ? 0.3 : 0.95}
                      filter="url(#shadow-sm)"
                      className="transition-all duration-200"
                    />
                    <text
                      textAnchor="middle"
                      dy="-0.25em"
                      className="text-xs font-semibold pointer-events-none select-none"
                      fill="#ffffff"
                    >
                      {label}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="1.4em"
                      className="text-[11px] pointer-events-none select-none"
                      fill="#ffffff"
                      opacity={0.9}
                    >
                      {node.sublabel}
                    </text>
                    <g transform={`translate(${w / 2 - 20}, ${-h / 2 + 12})`}>
                      <circle r="11" fill="#fff" opacity={dimmed ? 0.3 : 0.9} />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        className="text-[11px] font-bold pointer-events-none select-none"
                        fill={node.color}
                      >
                        {isExpanded ? "−" : "+"}
                      </text>
                    </g>
                  </g>
                );
              }

              if (node.kind === "collection") {
                const categoryId = node.id.replace("collection:", "");
                const leadsData = categoryLeadsMap[categoryId];
                const total = leadsData?.total || 0;
                const w = LAYOUT.collectionWidth;
                const headerH = LAYOUT.collectionHeaderHeight;
                const totalH = pos.height || headerH;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="transition-all duration-200"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    <rect
                      x={-w / 2}
                      y={-totalH / 2}
                      width={w}
                      height={totalH}
                      rx={LAYOUT.collectionRx}
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      opacity={dimmed ? 0.4 : 1}
                    />
                    <rect
                      x={-w / 2}
                      y={-totalH / 2}
                      width={w}
                      height={headerH}
                      rx={LAYOUT.collectionRx}
                      fill={node.color}
                      opacity={dimmed ? 0.3 : 0.95}
                    />
                    <text
                      x={-w / 2 + 14}
                      y={-totalH / 2 + 16}
                      className="text-xs font-semibold pointer-events-none select-none"
                      fill="#ffffff"
                    >
                      {node.label}
                    </text>
                    <text
                      x={-w / 2 + 14}
                      y={-totalH / 2 + 30}
                      className="text-[10px] pointer-events-none select-none"
                      fill="#ffffff"
                      opacity={0.9}
                    >
                      {total} total
                    </text>
                  </g>
                );
              }

              if (node.kind === "lead") {
                const w = LAYOUT.leadWidth;
                const h = LAYOUT.leadHeight;
                const rx = LAYOUT.leadRx;
                const label = node.label || "";
                const displayLabel = label.length > 14 ? label.slice(0, 13) + "…" : label;
                const sublabel = node.sublabel || "";
                const displaySublabel = sublabel.length > 16 ? sublabel.slice(0, 15) + "…" : sublabel;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                    className="cursor-pointer transition-all duration-200"
                  >
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={rx}
                      fill={isSelected ? "#7c3aed" : "#ffffff"}
                      stroke={isSelected ? "#7c3aed" : "#d4d4d8"}
                      strokeWidth={isSelected ? 2.5 : 1}
                      filter={isSelected ? "url(#glow-purple)" : "url(#shadow-sm)"}
                      opacity={dimmed ? 0.3 : 1}
                      className="transition-all duration-200"
                    />
                    <text
                      textAnchor="middle"
                      dy="-0.2em"
                      className="text-[11px] font-medium pointer-events-none select-none"
                      fill={isSelected ? "#ffffff" : "#18181b"}
                    >
                      {displayLabel}
                    </text>
                    {displaySublabel && (
                      <text
                        textAnchor="middle"
                        dy="1.2em"
                        className="text-[10px] pointer-events-none select-none"
                        fill={isSelected ? "#e9d5ff" : "#71717a"}
                      >
                        {displaySublabel}
                      </text>
                    )}
                  </g>
                );
              }

              const label = node.label || "";
              const displayLabel = label.length > 12 ? label.slice(0, 11) + "…" : label;

              return (
                <g
                  key={node.id}
                   transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                  className="cursor-pointer transition-all duration-200"
                >
                  <title>{node.label}{node.sublabel ? ` (${node.sublabel})` : ""}</title>
                  <circle
                    r={20}
                    fill={isSelected ? "#7c3aed" : "#ffffff"}
                    stroke={isSelected ? "#7c3aed" : "#d4d4d8"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    filter={isSelected ? "url(#glow-purple)" : "url(#shadow-sm)"}
                    opacity={dimmed ? 0.3 : 1}
                    className="transition-all duration-200"
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    className="text-[9px] font-medium pointer-events-none select-none"
                    fill={isSelected ? "#ffffff" : "#18181b"}
                  >
                    {displayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        <div className="absolute bottom-3 left-3 z-10">
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-slate-500">
            {totalLeads > 0 ? `${totalLeads.toLocaleString()} total leads` : "Loading..."}
            {expandedCategoryArray.length > 0 && (
              <span className="text-slate-400"> · {expandedCategoryArray.length} categories expanded</span>
            )}
            {visibleLeadCount > 0 && (
              <span className="text-slate-400"> · {visibleLeadCount} visible leads</span>
            )}
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
            layoutType="radial"
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

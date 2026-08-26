"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraphMemories } from "./graph-memories";
import { GraphCanvas } from "./graph-canvas";
import { GraphControls } from "./graph-controls";
import { GraphLegend } from "./graph-legend";
import { RecordDetailsPanel } from "./record-details-panel";
import { GraphExplorerCanvas } from "./graph-explorer-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Handshake } from "lucide-react";
import type { FixedGraphData } from "@/types/graph";
import { CATEGORY_CONFIG } from "@/types/graph";
import { useFixedGraphLayout, CATEGORY_ORDER } from "@/hooks/use-fixed-graph-layout";

type ViewMode = "graph" | "memories";
type GraphTypeState = null | "leads" | "deals";

const MAX_VISIBLE_CHILDREN = 4;

interface GraphViewProps {
  initialGraphType?: "leads" | "deals" | null;
  onBack?: () => void;
}

export function GraphView({ initialGraphType, onBack }: GraphViewProps = {}) {
  const [selectedRecord, setSelectedRecord] = useState<{
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [graphType, setGraphType] = useState<GraphTypeState>(initialGraphType ?? null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [fixedGraphData, setFixedGraphData] = useState<FixedGraphData | null>(null);
  const [loadingFixedGraph, setLoadingFixedGraph] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const currentRecordRef = useRef<string | null>(null);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["graph-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/graph/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []) as Array<{ id: string; type: string; label: string; secondaryText?: string }>;
    },
    enabled: searchQuery.trim().length > 0,
  });

  const handleBackToLanding = useCallback(() => {
    setGraphType(null);
    setSelectedRecord(null);
    setFixedGraphData(null);
    setExpandedCategories(new Set());
    onBack?.();
  }, [onBack]);

  const handleSelectRecord = useCallback(
    async (result: { entityType: string; entityId: string; displayName: string; secondaryText?: string }) => {
      setSelectedRecord(result);
      setViewMode("graph");
      setLoadingFixedGraph(true);
      setExpandedCategories(new Set());

      try {
        const res = await fetch(`/api/graph/fixed-graph?type=${result.entityType}&id=${result.entityId}`);
        if (res.ok) {
          const data = (await res.json()) as FixedGraphData;
          setFixedGraphData(data);
        }
      } catch {
        // Keep existing graph data visible on fetch error
      } finally {
        setLoadingFixedGraph(false);
      }
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRecord(null);
    setFixedGraphData(null);
    setExpandedCategories(new Set());
  }, []);

  const handleToggleCategory = useCallback((catKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) {
        next.delete(catKey);
      } else {
        next.add(catKey);
      }
      return next;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setCamera((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 2.5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCamera((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.5) }));
  }, []);

  const visibleFixedGraphData = useMemo<FixedGraphData | null>(() => {
    if (!fixedGraphData) return null;
    const expanded = expandedCategories;
    const categories: FixedGraphData["categories"] = {} as FixedGraphData["categories"];
    for (const key of CATEGORY_ORDER) {
      const cat = fixedGraphData.categories[key];
      const isExpanded = expanded.has(key);
      const visibleNodes = isExpanded ? cat.nodes : cat.nodes.slice(0, MAX_VISIBLE_CHILDREN);
      categories[key] = {
        count: isExpanded ? cat.totalCount : Math.min(cat.totalCount, MAX_VISIBLE_CHILDREN),
        totalCount: cat.totalCount,
        nodes: visibleNodes,
      };
    }
    return { ...fixedGraphData, categories };
  }, [fixedGraphData, expandedCategories]);

  const { positions } = useFixedGraphLayout(visibleFixedGraphData, canvasSize.width, canvasSize.height);

  const computeGraphBounds = useCallback(
    (positions: Map<string, { x: number; y: number; width: number; height: number }>) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [, pos] of positions) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + pos.width);
        maxY = Math.max(maxY, pos.y + pos.height);
      }
      if (!isFinite(minX)) return null;
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    },
    []
  );

  const fitToView = useCallback(
    (positions: Map<string, { x: number; y: number; width: number; height: number }>, vpWidth: number, vpHeight: number) => {
      const bounds = computeGraphBounds(positions);
      if (!bounds) return;

      const padding = 60;
      const availableWidth = vpWidth - padding * 2;
      const availableHeight = vpHeight - padding * 2;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      const scaleX = availableWidth / bounds.width;
      const scaleY = availableHeight / bounds.height;
      const scale = Math.min(scaleX, scaleY);

      setCamera({
        x: bounds.minX + bounds.width / 2,
        y: bounds.minY + bounds.height / 2,
        scale: Math.min(Math.max(scale, 0.6), 2.0),
      });
    },
    [computeGraphBounds]
  );

  const centerOnRoot = useCallback(() => {
    const rootPos = positions.get("root");
    if (rootPos) {
      setCamera({
        x: rootPos.x + rootPos.width / 2,
        y: rootPos.y + rootPos.height / 2,
        scale: 1.0,
      });
    }
  }, [positions]);

  const handleFitView = useCallback(() => {
    fitToView(positions, canvasSize.width, canvasSize.height);
  }, [fitToView, positions, canvasSize]);

  const handleResetView = useCallback(() => {
    centerOnRoot();
  }, [centerOnRoot]);

  const handleToggleLabels = useCallback(() => {}, []);

  const handleToggleLayout = useCallback(() => {}, []);

  const handleCenterSelected = useCallback(() => {
    centerOnRoot();
  }, [centerOnRoot]);

  useEffect(() => {
    const container = canvasWrapperRef.current;
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
    if (!positions.size || !fixedGraphData) return;

    const recordKey = `${fixedGraphData.root.type}:${fixedGraphData.root.id}`;
    if (currentRecordRef.current === recordKey) return;
    currentRecordRef.current = recordKey;

    const rootPos = positions.get("root");
    if (!rootPos) return;

    const id = requestAnimationFrame(() => {
      fitToView(positions, canvasSize.width, canvasSize.height);
    });

    return () => cancelAnimationFrame(id);
  }, [positions, fixedGraphData, fitToView, canvasSize]);

  const currentNode = fixedGraphData?.root ?? null;

  const legendCategories = useMemo(() => {
    if (!fixedGraphData) return [];
    return CATEGORY_ORDER.map((key) => {
      const cat = fixedGraphData.categories[key];
      return {
        key,
        label: CATEGORY_CONFIG[key]?.label || key,
        count: cat.totalCount,
        color: CATEGORY_CONFIG[key]?.color || "#6b7280",
      };
    });
  }, [fixedGraphData]);

  const showLeadsGraph = graphType === "leads" && viewMode === "graph" && !selectedRecord;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {graphType && (
              <button
                onClick={handleBackToLanding}
                className="text-xs text-slate-500 hover:text-slate-900 transition-colors -ml-1 shrink-0"
              >
                ← Back
              </button>
            )}
            {graphType ? (
              <>
                <Badge
                  variant="neutral"
                  className={`shrink-0 ${
                    graphType === "deals"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-cyan-50 text-cyan-700 border-cyan-200"
                  }`}
                >
                  {graphType === "deals" ? "Deals" : "Leads"}
                </Badge>
                <span className="text-sm font-semibold truncate text-slate-900">
                  {graphType === "deals" ? "Deals" : "Leads"} Graph
                </span>
              </>
            ) : (
              <>
                <h1 className="text-sm font-semibold text-slate-900">Knowledge Graph</h1>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Explore relationships between customers, leads, deals, and organizational memory.
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="h-8 w-40 rounded-md border border-gray-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500/50"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full end-0 mt-1 w-64 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl z-50">
                  {searchResults.map((result: { id: string; type: string; label: string; secondaryText?: string }) => (
                    <button
                      key={`${result.type}:${result.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (result.type === "lead") {
                          setSelectedNodeId(`lead:${result.id}`);
                        } else {
                          handleSelectRecord({
                            entityType: result.type,
                            entityId: result.id,
                            displayName: result.label,
                            secondaryText: result.secondaryText,
                          });
                        }
                        setSearchQuery("");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-slate-900 truncate block">{result.label}</span>
                        {result.secondaryText && (
                          <span className="text-[10px] text-slate-500 truncate block">{result.secondaryText}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 capitalize">{result.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
              <Button
                variant={viewMode === "graph" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("graph")}
                className={`rounded-md h-7 text-[11px] px-2.5 transition-colors ${
                  viewMode === "graph"
                    ? "bg-purple-50 text-purple-700 hover:text-purple-800"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Graph
              </Button>
              <Button
                variant={viewMode === "memories" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("memories")}
                className={`rounded-md h-7 text-[11px] px-2.5 transition-colors ${
                  viewMode === "memories"
                    ? "bg-purple-50 text-purple-700 hover:text-purple-800"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Memories
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 pb-4">
        {showLeadsGraph && (
          <div className="flex-1 min-h-0 flex flex-col">
            <GraphExplorerCanvas
              onSelectRecord={handleSelectRecord}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchResults={searchResults}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}

        {viewMode === "graph" && graphType === "deals" && !selectedRecord && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 relative rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
              <div className="text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-purple-50 text-purple-600 mx-auto mb-3">
                  <Handshake className="size-6" />
                </div>
                <h3 className="text-sm font-medium text-slate-900">Deals Graph</h3>
                <p className="mt-1 text-xs text-slate-500">Graph visualization coming soon.</p>
              </div>
            </div>
          </div>
        )}

        {viewMode === "graph" && !graphType && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 relative rounded-xl border border-gray-200 bg-white overflow-hidden" />
          </div>
        )}

        {viewMode === "graph" && selectedRecord && (
          <div className="flex-1 min-h-0 flex flex-row gap-3">
            <div ref={canvasWrapperRef} className="flex-1 min-h-0 relative rounded-xl border border-gray-200 bg-white overflow-hidden">
              {!currentNode && !loadingFixedGraph && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-xs text-slate-500">Select a lead or deal from the sidebar to explore its graph.</p>
                </div>
              )}
              {loadingFixedGraph && currentNode && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="size-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
              )}
              {currentNode && (
                <GraphCanvas
                  rootNode={currentNode}
                  fixedGraphData={visibleFixedGraphData}
                  positions={positions}
                  camera={camera}
                  onCameraChange={setCamera}
                  onToggleCategory={handleToggleCategory}
                  expandedCategories={expandedCategories}
                />
              )}
              {currentNode && (
                <>
                  <div className="absolute bottom-3 left-3 z-10">
                    <GraphLegend categories={legendCategories} />
                  </div>
                  <div className="absolute top-3 end-3 z-10 flex flex-col gap-1.5">
                    <GraphControls
                      zoom={camera.scale}
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      onFitView={handleFitView}
                      onReset={handleResetView}
                      onCenterSelected={handleCenterSelected}
                      onExpandSelected={() => {}}
                      onCollapseSelected={() => {}}
                      onToggleLabels={handleToggleLabels}
                      onToggleLayout={handleToggleLayout}
                      showLabels={true}
                      layoutType="radial"
                      selectedNode={null}
                      canExpand={false}
                      canCollapse={false}
                      onClearSelection={handleClearSelection}
                    />
                  </div>
                </>
              )}
            </div>
            {currentNode && (
              <div className="shrink-0 w-[360px]">
                <RecordDetailsPanel
                  entityType={currentNode.type}
                  entityId={currentNode.id}
                  fixedGraphData={fixedGraphData}
                  onSelectNode={handleSelectRecord}
                />
              </div>
            )}
          </div>
        )}

        {viewMode === "memories" && selectedRecord && currentNode && (
          <div className="flex-1 min-h-0 px-6 pb-4">
            <GraphMemories
              entityType={currentNode.type}
              entityId={currentNode.id}
              entityLabel={currentNode.label}
            />
          </div>
        )}

        {viewMode === "memories" && graphType && !selectedRecord && (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className="text-xs text-slate-500">
              Memories will be available once a specific {graphType === "leads" ? "lead" : "deal"} is selected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { GraphNode, FixedGraphData } from "@/types/graph";
import { NODE_TYPE_CONFIG, CATEGORY_CONFIG } from "@/types/graph";
import {
  getNodeKey,
  ROOT_WIDTH,
  ROOT_HEIGHT,
  CATEGORY_WIDTH,
  CATEGORY_HEIGHT,
  CATEGORY_ORDER,
} from "@/hooks/use-fixed-graph-layout";
import {
  User,
  Users,
  CheckSquare,
  Phone,
  Zap,
  Link,
} from "lucide-react";

interface GraphCanvasProps {
  rootNode: GraphNode;
  fixedGraphData: FixedGraphData | null;
  positions: Map<string, { x: number; y: number; width: number; height: number; isRoot: boolean; isCategory: boolean; isOwner: boolean; parentKey?: string }>;
  camera: { x: number; y: number; scale: number };
  onCameraChange: (camera: { x: number; y: number; scale: number }) => void;
  onToggleCategory?: (catKey: string) => void;
  expandedCategories?: Set<string>;
}

const DARK_COLORS = {
  background: "#050A14",
  surface: "#0B1120",
  surfaceHover: "#111827",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.15)",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  edge: "rgba(148,163,184,0.35)",
  edgeLabel: "#94a3b8",
  tooltipBg: "#0f172a",
  tooltipBorder: "rgba(255,255,255,0.08)",
  arrowhead: "#94a3b8",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  owner: User,
  leads: Users,
  users: Users,
  tasks: CheckSquare,
  activities: Phone,
  actions: Zap,
  related: Link,
};

function getEdgeLine(
  sourcePos: { x: number; y: number; width: number; height: number },
  targetPos: { x: number; y: number; width: number; height: number }
): { x1: number; y1: number; x2: number; y2: number } {
  const sx = sourcePos.x + sourcePos.width / 2;
  const sy = sourcePos.y + sourcePos.height / 2;
  const tx = targetPos.x + targetPos.width / 2;
  const ty = targetPos.y + targetPos.height / 2;

  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const shrinkSource = Math.max(sourcePos.width, sourcePos.height) / 2 + 4;
  const shrinkTarget = Math.max(targetPos.width, targetPos.height) / 2 + 8;

  return {
    x1: sx + nx * shrinkSource,
    y1: sy + ny * shrinkSource,
    x2: tx - nx * shrinkTarget,
    y2: ty - ny * shrinkTarget,
  };
}

export function GraphCanvas({
  rootNode,
  fixedGraphData,
  positions,
  camera,
  onCameraChange,
  onToggleCategory,
  expandedCategories = new Set(),
}: GraphCanvasProps) {
  const [hoveredItem, setHoveredItem] = useState<{
    kind: "node" | "category";
    node?: GraphNode;
    catKey?: string;
    pos: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  const rootKey = "root";

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
      onCameraChange({
        ...camera,
        scale: Math.min(Math.max(camera.scale * delta, 0.5), 3),
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [camera, onCameraChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
      }
    },
    [camera]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        onCameraChange({
          ...camera,
          x: dragStart.current.camX - dx / camera.scale,
          y: dragStart.current.camY - dy / camera.scale,
        });
      }
    },
    [isDragging, camera, onCameraChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const width = canvasSize.width;
  const height = canvasSize.height;
  const viewBox = `${camera.x - width / camera.scale / 2} ${camera.y - height / camera.scale / 2} ${width / camera.scale} ${height / camera.scale}`;

  const rootFallbackPos = useMemo(() => ({ x: width / 2 - ROOT_WIDTH / 2, y: height / 2 - ROOT_HEIGHT / 2, width: ROOT_WIDTH, height: ROOT_HEIGHT }), [width, height]);
  const rootPos = positions.get(rootKey) || rootFallbackPos;

  const getNodeDisplayLabel = useCallback((node: GraphNode): string => {
    if (node.label.length <= 22) return node.label;
    return node.label.slice(0, 20) + "…";
  }, []);

  const getNodeSubLabel = useCallback((node: GraphNode): string => {
    if (!node.sublabel) return "";
    if (node.sublabel.length <= 14) return node.sublabel;
    return node.sublabel.slice(0, 12) + "…";
  }, []);

  const getChildMeta = useCallback((node: GraphNode): { date?: string; status?: string } => {
    const meta = node.metadata as Record<string, unknown> | undefined;
    let date: string | undefined;
    let status: string | undefined;

    if (node.type === "task") {
      date = meta?.due_at as string | undefined;
      status = (meta?.status as string) || node.sublabel || "";
    } else if (node.type === "activity") {
      date = meta?.occurred_at as string | undefined;
      status = node.sublabel || "";
    } else if (node.type === "event") {
      date = meta?.occurred_at as string | undefined;
      status = "Action";
    } else if (node.type === "user") {
      status = (meta?.roles as string) || "Employee";
    } else {
      status = node.sublabel || "";
    }

    if (date) {
      try {
        const d = new Date(date);
        date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch {
        date = date.slice(0, 10);
      }
    }

    return { date, status };
  }, []);

  const getCategoryColor = useCallback((catKey: string): string => {
    return CATEGORY_CONFIG[catKey]?.color || "#6b7280";
  }, []);

  const getCategoryIcon = useCallback((catKey: string): React.ElementType => {
    return CATEGORY_ICONS[catKey] || Link;
  }, []);

  const getEntityColor = useCallback((node: GraphNode): string => {
    return node.color || NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG]?.color || "#6b7280";
  }, []);

  const renderEdge = useCallback((key: string, x1: number, y1: number, x2: number, y2: number, color: string, dashed = false, label?: string, markerEnd?: string) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return (
      <g key={key}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={dashed ? 0.8 : 1.2}
          strokeOpacity={dashed ? 0.15 : 0.5}
          strokeDasharray={dashed ? "3 3" : "none"}
          markerEnd={markerEnd}
          className="transition-all duration-200"
        />
        {label && (
          <text
            x={midX}
            y={midY - 6}
            textAnchor="middle"
            className="text-[8px] pointer-events-none select-none"
            fill={DARK_COLORS.edgeLabel}
          >
            {label}
          </text>
        )}
      </g>
    );
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-0 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        viewBox={viewBox}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.4" />
          </filter>
          <filter id="shadow-md" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
          </filter>
          <filter id="glow-purple" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#7c3aed" floodOpacity="0.35" />
          </filter>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill={DARK_COLORS.arrowhead} />
          </marker>
          <marker
            id="arrowhead-root"
            markerWidth="10"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#7c3aed" />
          </marker>
        </defs>

        {fixedGraphData && (() => {
          const edges = [];

          const categoryKeys = ["owner", "leads", "tasks", "activities", "actions", "related", "users"] as const;

          for (const catKey of categoryKeys) {
            const category = fixedGraphData.categories[catKey];
            const catPos = positions.get(`category:${catKey}`);
            if (!catPos) continue;

            const catColor = getCategoryColor(catKey);

            const rootEdge = getEdgeLine(rootPos, catPos);
            edges.push(
              renderEdge(
                `root-${catKey}`,
                rootEdge.x1,
                rootEdge.y1,
                rootEdge.x2,
                rootEdge.y2,
                catColor,
                category.count === 0,
                category.count > 0 ? CATEGORY_CONFIG[catKey]?.label : undefined,
                "url(#arrowhead-root)"
              )
            );

            for (const child of category.nodes) {
              const childPos = positions.get(getNodeKey(child));
              if (!childPos) continue;

              const catToChild = getEdgeLine(catPos, childPos);
              edges.push(
                renderEdge(
                  `cat-${catKey}-${getNodeKey(child)}`,
                  catToChild.x1,
                  catToChild.y1,
                  catToChild.x2,
                  catToChild.y2,
                  catColor,
                  false,
                  undefined,
                  "url(#arrowhead)"
                )
              );
            }
          }

          return <g>{edges}</g>;
        })()}

        {fixedGraphData && CATEGORY_ORDER.map((catKey) => {
          const category = fixedGraphData.categories[catKey];
          const cfg = CATEGORY_CONFIG[catKey];
          if (!cfg || !category) return null;

          const catPos = positions.get(`category:${catKey}`);
          if (!catPos) return null;

          const isHovered = hoveredItem?.kind === "category" && hoveredItem.catKey === catKey;
          const isExpanded = expandedCategories.has(catKey);
          const hasHidden = category.totalCount > category.nodes.length;
          const catColor = cfg.color;
          const catCenterX = catPos.x + CATEGORY_WIDTH / 2;
          const catCenterY = catPos.y + CATEGORY_HEIGHT / 2;
          const CategoryIcon = getCategoryIcon(catKey);
          const catLabel = cfg.label.length > 10 ? cfg.label.slice(0, 9) + "…" : cfg.label;

          return (
            <g
              key={`cat-node-${catKey}`}
              transform={`translate(${catCenterX}, ${catCenterY})`}
              onMouseEnter={() => setHoveredItem({
                kind: "category",
                catKey,
                pos: { x: catPos.x, y: catPos.y, width: CATEGORY_WIDTH, height: CATEGORY_HEIGHT }
              })}
              onMouseLeave={() => setHoveredItem(null)}
              className={hasHidden ? "cursor-pointer" : "cursor-default"}
              onClick={() => {
                if (hasHidden && onToggleCategory) {
                  onToggleCategory(catKey);
                }
              }}
            >
              <rect
                x={-CATEGORY_WIDTH / 2}
                y={-CATEGORY_HEIGHT / 2}
                width={CATEGORY_WIDTH}
                height={CATEGORY_HEIGHT}
                rx={10}
                fill={DARK_COLORS.surface}
                stroke={isHovered ? catColor : DARK_COLORS.border}
                strokeWidth={isHovered ? 1.5 : 1}
                className="transition-all duration-200"
                filter="url(#shadow-sm)"
              />
              <rect
                x={-CATEGORY_WIDTH / 2}
                y={-CATEGORY_HEIGHT / 2}
                width={4}
                height={CATEGORY_HEIGHT}
                rx={2}
                fill={catColor}
              />
              <g transform={`translate(${-CATEGORY_WIDTH / 2 + 14}, ${-6})`}>
                <CategoryIcon className="size-3.5 pointer-events-none select-none" style={{ fill: "none", stroke: catColor, strokeWidth: 2 }} />
              </g>
              <text
                x={-CATEGORY_WIDTH / 2 + 26}
                y={1}
                className="text-[11px] font-medium pointer-events-none select-none"
                fill={isHovered ? catColor : DARK_COLORS.textPrimary}
              >
                {catLabel}
              </text>
              <text
                x={CATEGORY_WIDTH / 2 - 8}
                y={1}
                textAnchor="end"
                className="text-[10px] font-medium pointer-events-none select-none"
                fill={DARK_COLORS.textTertiary}
              >
                {category.totalCount}
              </text>
              {hasHidden && (
                <text
                  x={CATEGORY_WIDTH / 2 - 8}
                  y={14}
                  textAnchor="end"
                  className="text-[8px] font-medium pointer-events-none select-none"
                  fill={isExpanded ? catColor : DARK_COLORS.textSecondary}
                >
                  {isExpanded ? "−" : `+${category.totalCount - category.nodes.length}`}
                </text>
              )}
            </g>
          );
        })}

        {fixedGraphData && CATEGORY_ORDER.map((catKey) => {
          const category = fixedGraphData.categories[catKey];
          if (!category) return null;

          return category.nodes.map((node) => {
            const key = getNodeKey(node);
            const pos = positions.get(key);
            if (!pos) return null;

            const isHovered = hoveredItem?.kind === "node" && hoveredItem.node?.id === node.id && hoveredItem.node?.type === node.type;
            const nodeColor = getEntityColor(node);
            const label = getNodeDisplayLabel(node);
            const { date, status } = getChildMeta(node);
            const nodeW = pos.width;
            const nodeH = pos.height;

            return (
              <g
                key={key}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredItem({
                  kind: "node",
                  node,
                  pos: { x: pos.x, y: pos.y, width: nodeW, height: nodeH }
                })}
                onMouseLeave={() => setHoveredItem(null)}
                className="cursor-pointer"
              >
                <rect
                  x={0}
                  y={0}
                  width={nodeW}
                  height={nodeH}
                  rx={10}
                  fill={DARK_COLORS.surface}
                  stroke={isHovered ? nodeColor : DARK_COLORS.border}
                  strokeWidth={isHovered ? 1.5 : 1}
                  className="transition-all duration-200"
                  filter="url(#shadow-sm)"
                />
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={nodeH}
                  rx={2}
                  fill={nodeColor}
                />
                <text
                  x={84}
                  y={22}
                  textAnchor="middle"
                  className="text-[11px] font-semibold pointer-events-none select-none"
                  fill={DARK_COLORS.textPrimary}
                >
                  {label}
                </text>
                {status && (
                  <text
                    x={84}
                    y={36}
                    textAnchor="middle"
                    className="text-[9px] pointer-events-none select-none"
                    fill={DARK_COLORS.textSecondary}
                  >
                    {status}
                  </text>
                )}
                {date && (
                  <text
                    x={84}
                    y={50}
                    textAnchor="middle"
                    className="text-[8px] pointer-events-none select-none"
                    fill={DARK_COLORS.textTertiary}
                  >
                    {date}
                  </text>
                )}
              </g>
            );
          });
        })}

        {fixedGraphData && (() => {
          const rootColor = getEntityColor(rootNode);
          const label = getNodeDisplayLabel(rootNode);
          const sublabel = getNodeSubLabel(rootNode);
          const rootCenterX = rootPos.x + ROOT_WIDTH / 2;
          const rootCenterY = rootPos.y + ROOT_HEIGHT / 2;
          const rootW = ROOT_WIDTH;
          const rootH = ROOT_HEIGHT;

          return (
            <g
              transform={`translate(${rootCenterX}, ${rootCenterY})`}
              onMouseEnter={() => setHoveredItem({
                kind: "node",
                node: rootNode,
                pos: { x: rootPos.x, y: rootPos.y, width: rootW, height: rootH }
              })}
              onMouseLeave={() => setHoveredItem(null)}
              className="cursor-pointer"
            >
              <rect
                x={-rootW / 2 - 20}
                y={-rootH / 2 - 20}
                width={rootW + 40}
                height={rootH + 40}
                rx={rootH / 2 + 20}
                fill="#7c3aed"
                opacity={0.2}
                filter="url(#glow-purple)"
              />
              <rect
                x={-rootW / 2 - 12}
                y={-rootH / 2 - 12}
                width={rootW + 24}
                height={rootH + 24}
                rx={rootH / 2 + 12}
                fill="#7c3aed"
                opacity={0.1}
              />
              <rect
                x={-rootW / 2}
                y={-rootH / 2}
                width={rootW}
                height={rootH}
                rx={rootH / 2}
                fill={DARK_COLORS.surface}
                stroke={rootColor}
                strokeWidth={2}
                className="transition-all duration-200"
                filter="url(#shadow-md)"
              />
              <rect
                x={-rootW / 2}
                y={-rootH / 2}
                width={5}
                height={rootH}
                rx={2.5}
                fill={rootColor}
              />
              <text
                x={0}
                y={-7}
                textAnchor="middle"
                className="text-[12px] font-semibold pointer-events-none select-none"
                fill={DARK_COLORS.textSecondary}
              >
                {sublabel}
              </text>
              <text
                x={0}
                y={12}
                textAnchor="middle"
                className="text-[14px] font-bold pointer-events-none select-none"
                fill={DARK_COLORS.textPrimary}
              >
                {label}
              </text>
            </g>
          );
        })()}

        {hoveredItem && (() => {
          let tooltipLabel = "";
          let tooltipType = "";
          let tooltipColor = "#6b7280";
          let tooltipSubtitle = "";
          const pos = hoveredItem.pos;

          if (hoveredItem.kind === "node" && hoveredItem.node) {
            const node = hoveredItem.node;
            tooltipLabel = getNodeDisplayLabel(node);
            tooltipType = NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG]?.label || node.type;
            tooltipColor = getEntityColor(node);
            tooltipSubtitle = node.sublabel || "";
          } else if (hoveredItem.kind === "category" && hoveredItem.catKey && fixedGraphData) {
            const catKey = hoveredItem.catKey;
            tooltipLabel = CATEGORY_CONFIG[catKey]?.label || catKey;
            tooltipType = "Category";
            tooltipColor = getCategoryColor(catKey);
            tooltipSubtitle = `${fixedGraphData.categories[catKey as keyof typeof fixedGraphData.categories]?.totalCount ?? 0} records`;
          }

          const boxWidth = Math.max(160, tooltipLabel.length * 7 + 20);
          return (
            <g transform={`translate(${pos.x + pos.width / 2}, ${pos.y - 18})`}>
              <rect
                x={-boxWidth / 2}
                y={-28}
                width={boxWidth}
                height={56}
                rx={8}
                fill={DARK_COLORS.tooltipBg}
                fillOpacity={0.98}
                stroke={DARK_COLORS.tooltipBorder}
                strokeWidth={1}
                filter="url(#shadow-sm)"
              />
              <circle cx={-boxWidth / 2 + 18} cy={0} r={5} fill={tooltipColor} />
              <text x={-boxWidth / 2 + 32} y={4} className="text-[10px] fill-slate-400 font-medium capitalize">
                {tooltipType}
              </text>
              <text x={0} y={-6} className="text-[11px] fill-slate-100 font-semibold">
                {tooltipLabel.length > 24 ? tooltipLabel.slice(0, 22) + "…" : tooltipLabel}
              </text>
              <text x={0} y={10} className="text-[9px] fill-slate-500">
                {tooltipSubtitle}
              </text>
            </g>
          );
        })()}
      </svg>

      <div className="absolute bottom-3 left-3 z-10">
        <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-slate-500">
          {fixedGraphData
            ? `${Object.values(fixedGraphData.categories).reduce((sum, cat) => sum + (cat.totalCount ?? cat.count), 0)} records`
            : "No data"}
        </div>
      </div>
    </div>
  );
}

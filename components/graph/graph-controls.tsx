"use client";

import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Expand,
  Minus,
  Tag,
  Move3D,
  X,
  Crosshair,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface GraphControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  onCenterSelected: () => void;
  onExpandSelected: () => void;
  onCollapseSelected: () => void;
  onToggleLabels: () => void;
  onToggleLayout: () => void;
  showLabels: boolean;
  layoutType: "force" | "radial";
  selectedNode: { type: string; id: string } | null;
  canExpand: boolean;
  canCollapse: boolean;
  onClearSelection: () => void;
  className?: string;
}

export function GraphControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
  onCenterSelected,
  onExpandSelected,
  onCollapseSelected,
  onToggleLabels,
  onToggleLayout,
  showLabels,
  layoutType,
  selectedNode,
  canExpand,
  canCollapse,
  onClearSelection,
  className,
}: GraphControlsProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onZoomIn}
          title="Zoom in"
        >
          <ZoomIn className="size-3.5" />
        </Button>
        <div className="px-1.5 py-1 text-center">
          <span className="text-[10px] font-mono text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onFitView}
          title="Fit graph"
        >
          <Maximize className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onReset}
          title="Reset view"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onCenterSelected}
          title="Center selected"
        >
          <Crosshair className="size-3.5" />
        </Button>
      </div>

      {selectedNode && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
            onClick={onExpandSelected}
            disabled={!canExpand}
            title="Expand selected"
          >
            <Expand className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
            onClick={onCollapseSelected}
            disabled={!canCollapse}
            title="Collapse selected"
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
            onClick={onClearSelection}
            title="Clear selection"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <Button
          variant={showLabels ? "secondary" : "ghost"}
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onToggleLabels}
          title="Toggle relationship labels"
        >
          <Tag className="size-3.5" />
        </Button>
        <Button
          variant={layoutType === "force" ? "secondary" : "ghost"}
          size="icon"
          className="size-8 text-slate-500 hover:text-slate-900 hover:bg-gray-100"
          onClick={onToggleLayout}
          title={`${layoutType === "force" ? "Switch to radial" : "Switch to force"} layout`}
        >
          <Move3D className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

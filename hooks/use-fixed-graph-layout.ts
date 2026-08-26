"use client";

import { useMemo } from "react";
import type { FixedGraphData, GraphNode } from "@/types/graph";

export interface FixedNodePosition {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
  isCategory: boolean;
  isOwner: boolean;
  parentKey?: string;
}

export const ROOT_WIDTH = 200;
export const ROOT_HEIGHT = 68;
export const CATEGORY_WIDTH = 120;
export const CATEGORY_HEIGHT = 44;
export const CHILD_WIDTH = 136;
export const CHILD_HEIGHT = 52;
export const CHILD_STACK_GAP = 16;
export const CATEGORY_TO_CHILD_GAP = 44;
export const MAX_CHILDREN_PER_COLUMN = 3;
export const SECONDARY_COLUMN_OFFSET = 170;

export const CATEGORY_OFFSETS: Record<string, { x: number; y: number }> = {
  owner:      { x: 0, y: -140 },
  leads:      { x: -190, y: -100 },
  tasks:      { x: 190, y: -100 },
  activities: { x: -190, y: 50 },
  actions:    { x: -190, y: 120 },
  related:    { x: 0, y: 140 },
  users:      { x: 190, y: 50 },
};

export const CATEGORY_ORDER = ["owner", "leads", "tasks", "activities", "actions", "related", "users"] as const;

export const CHILD_DIRECTION: Record<string, { primary: { dx: number; dy: number }; secondary: { dx: number; dy: number } }> = {
  owner:      { primary: { dx: 0, dy: -1 }, secondary: { dx: 1, dy: 0 } },
  leads:      { primary: { dx: -1, dy: -1 }, secondary: { dx: 1, dy: 0 } },
  tasks:      { primary: { dx: 1, dy: -1 }, secondary: { dx: -1, dy: 0 } },
  activities: { primary: { dx: -1, dy: 0 }, secondary: { dx: 0, dy: 1 } },
  actions:    { primary: { dx: -1, dy: 1 }, secondary: { dx: 1, dy: 0 } },
  related:    { primary: { dx: 0, dy: 1 }, secondary: { dx: 1, dy: 0 } },
  users:      { primary: { dx: 1, dy: 0 }, secondary: { dx: 0, dy: 1 } },
};

function getNodeKey(node: GraphNode): string {
  return `${node.type}:${node.id}`;
}

export function getChildPosition(
  catCenterX: number,
  catCenterY: number,
  rootCenterX: number,
  rootCenterY: number,
  childIndex: number,
  childCount: number,
): { x: number; y: number } {
  if (childCount === 0) return { x: catCenterX, y: catCenterY };

  const dx = catCenterX - rootCenterX;
  const dy = catCenterY - rootCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const outX = dx / dist;
  const outY = dy / dist;

  const isMostlyHorizontal = Math.abs(outX) > Math.abs(outY);
  const gapFromCategory = CATEGORY_TO_CHILD_GAP;
  const maxPerCol = MAX_CHILDREN_PER_COLUMN;
  const totalCols = Math.ceil(childCount / maxPerCol);

  const colIndex = Math.floor(childIndex / maxPerCol);
  const rowIndex = childIndex % maxPerCol;

  let clusterWidth: number, clusterHeight: number;
  if (isMostlyHorizontal) {
    const maxRows = Math.max(...Array.from({ length: totalCols }, (_, i) =>
      Math.min(maxPerCol, childCount - i * maxPerCol)
    ));
    clusterHeight = maxRows * CHILD_HEIGHT + Math.max(0, maxRows - 1) * CHILD_STACK_GAP;
    clusterWidth = totalCols * CHILD_WIDTH + Math.max(0, totalCols - 1) * CHILD_STACK_GAP;
  } else {
    const maxCols = Math.max(...Array.from({ length: totalCols }, (_, i) =>
      Math.min(maxPerCol, childCount - i * maxPerCol)
    ));
    clusterWidth = maxCols * CHILD_WIDTH + Math.max(0, maxCols - 1) * CHILD_STACK_GAP;
    clusterHeight = totalCols * CHILD_HEIGHT + Math.max(0, totalCols - 1) * CHILD_STACK_GAP;
  }

  const clusterCenterX = catCenterX + outX * (CATEGORY_WIDTH / 2 + gapFromCategory + clusterWidth / 2);
  const clusterCenterY = catCenterY + outY * (CATEGORY_HEIGHT / 2 + gapFromCategory + clusterHeight / 2);

  const offsetX = isMostlyHorizontal
    ? (colIndex - (totalCols - 1) / 2) * (CHILD_WIDTH + CHILD_STACK_GAP)
    : (rowIndex - (maxPerCol - 1) / 2) * (CHILD_WIDTH + CHILD_STACK_GAP);

  const offsetY = isMostlyHorizontal
    ? (rowIndex - (maxPerCol - 1) / 2) * (CHILD_HEIGHT + CHILD_STACK_GAP)
    : (colIndex - (totalCols - 1) / 2) * (CHILD_HEIGHT + CHILD_STACK_GAP);

  return {
    x: clusterCenterX + offsetX - CHILD_WIDTH / 2,
    y: clusterCenterY + offsetY - CHILD_HEIGHT / 2,
  };
}

export function clampToViewport(
  x: number,
  y: number,
  w: number,
  h: number,
  viewportW: number,
  viewportH: number,
  margin = 8,
): { x: number; y: number } {
  const minX = margin;
  const maxX = Math.max(minX, viewportW - w - margin);
  const minY = margin;
  const maxY = Math.max(minY, viewportH - h - margin);
  return { x: Math.max(minX, Math.min(x, maxX)), y: Math.max(minY, Math.min(y, maxY)) };
}

export function useFixedGraphLayout(data: FixedGraphData | null, width: number, height: number) {
  const positions = useMemo((): Map<string, FixedNodePosition> => {
    if (!data || width <= 0 || height <= 0) return new Map<string, FixedNodePosition>();

    const cx = width / 2;
    const cy = height / 2;
    const result = new Map<string, FixedNodePosition>();
    const rootKey = "root";

    result.set(rootKey, {
      key: rootKey,
      x: cx - ROOT_WIDTH / 2,
      y: cy - ROOT_HEIGHT / 2,
      width: ROOT_WIDTH,
      height: ROOT_HEIGHT,
      isRoot: true,
      isCategory: false,
      isOwner: false,
    });

    const rootCenterX = cx;
    const rootCenterY = cy;

    for (const catKey of CATEGORY_ORDER) {
      const offset = CATEGORY_OFFSETS[catKey];
      const catCenterX = cx + offset.x;
      const catCenterY = cy + offset.y;
      const catX = catCenterX - CATEGORY_WIDTH / 2;
      const catY = catCenterY - CATEGORY_HEIGHT / 2;

      const catPositionKey = `category:${catKey}`;
      result.set(catPositionKey, {
        key: catPositionKey,
        x: catX,
        y: catY,
        width: CATEGORY_WIDTH,
        height: CATEGORY_HEIGHT,
        isRoot: false,
        isCategory: true,
        isOwner: catKey === "owner",
      });

      const children = data.categories[catKey]?.nodes ?? [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childKey = getNodeKey(child);
        const ideal = getChildPosition(catCenterX, catCenterY, rootCenterX, rootCenterY, i, children.length);

        result.set(childKey, {
          key: childKey,
          x: ideal.x,
          y: ideal.y,
          width: CHILD_WIDTH,
          height: CHILD_HEIGHT,
          isRoot: false,
          isCategory: false,
          isOwner: false,
          parentKey: catPositionKey,
        });
      }
    }

    return result;
  }, [data, width, height]);

  return { positions };
}

export {
  getNodeKey,
};

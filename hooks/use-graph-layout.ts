"use client";

import { useCallback, useMemo, useRef, useEffect, useSyncExternalStore } from "react";
import type { GraphEdge, GraphNode } from "@/types/graph";
import type { GroupNode } from "@/hooks/use-graph-state";

export interface GraphLayoutNode {
  node: GraphNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  depth: number;
}

export interface GraphLayoutGroupNode {
  group: GroupNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface UseGraphLayoutOptions {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  groupNodes: GroupNode[];
  rootKey: string | null;
  width: number;
  height: number;
  layoutType: "force" | "radial";
}

interface LayoutItem {
  key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  depth: number;
  isGroup: boolean;
  parentKey?: string;
}

function createLayoutStore() {
  let positions = new Map<string, { x: number; y: number }>();
  const listeners = new Set<() => void>();

  const getSnapshot = () => positions;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const setPositions = (next: Map<string, { x: number; y: number }>) => {
    if (positions.size === next.size) {
      let same = true;
      for (const [key, pos] of next) {
        const current = positions.get(key);
        if (!current || current.x !== pos.x || current.y !== pos.y) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    positions = next;
    listeners.forEach((l) => l());
  };

  return { getSnapshot, subscribe, setPositions };
}

const layoutStore = createLayoutStore();

export const EMPTY_GROUP_NODES: GroupNode[] = [];

function computeDepth(key: string, rootKey: string | null, edges: GraphEdge[]): number {
  if (!rootKey || key === rootKey) return 0;

  const visited = new Set<string>();
  const queue: { key: string; depth: number }[] = [{ key: rootKey, depth: 0 }];
  visited.add(rootKey);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      let neighborKey: string | null = null;
      if (edge.source === current.key) neighborKey = edge.target;
      else if (edge.target === current.key) neighborKey = edge.source;
      if (neighborKey && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        if (neighborKey === key) return current.depth + 1;
        queue.push({ key: neighborKey, depth: current.depth + 1 });
      }
    }
  }

  return 2;
}

const EMPTY_POSITIONS = new Map<string, { x: number; y: number }>();

export function useGraphLayout({
  nodes,
  edges,
  groupNodes,
  rootKey,
  width,
  height,
  layoutType,
}: UseGraphLayoutOptions) {
  const positions = useSyncExternalStore(
    layoutStore.subscribe,
    layoutStore.getSnapshot,
    () => EMPTY_POSITIONS
  );
  const layoutItems = useRef<Map<string, LayoutItem>>(new Map());
  const frameRef = useRef<number>(0);
  const prevRootKeyRef = useRef<string | null>(null);

  const cx = width / 2;
  const cy = height / 2;

  const getNodeRadius = useCallback((isRoot: boolean, isGroup: boolean = false): number => {
    if (isRoot) return 52;
    if (isGroup) return 24;
    return 32;
  }, []);

  const getDepthRadius = useCallback((depth: number): number => {
    if (depth === 0) return 0;
    if (depth === 1) return 160;
    if (depth === 2) return 280;
    return 180 + depth * 140;
  }, []);

  const sortKey = useCallback((key: string): number => {
    const [type] = key.split(":");
    const order = ["customer", "lead", "deal", "activity", "task", "user", "contact", "note", "source", "stage", "industry", "event", "memory"];
    return order.indexOf(type);
  }, []);

  useEffect(() => {
    const hasNodes = nodes.size > 0 || groupNodes.length > 0;
    const hasRoot = !!rootKey;
    if (!hasNodes && !hasRoot) return;

    const next = new Map<string, LayoutItem>();
    const nodeArray = Array.from(nodes.entries());
    const rootChanged = prevRootKeyRef.current !== rootKey;
    prevRootKeyRef.current = rootKey;

    if (rootKey && !nodes.has(rootKey)) {
      const existing = layoutItems.current.get(rootKey);
      next.set(rootKey, {
        key: rootKey,
        x: existing ? existing.x : cx,
        y: existing ? existing.y : cy,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        radius: getNodeRadius(true),
        depth: 0,
        isGroup: false,
      });
    }

    const sortedNodeArray = [...nodeArray].sort((a, b) => {
      const depthA = computeDepth(a[0], rootKey, edges);
      const depthB = computeDepth(b[0], rootKey, edges);
      if (depthA !== depthB) return depthA - depthB;
      return sortKey(a[0]) - sortKey(b[0]);
    });

    for (const [key] of sortedNodeArray) {
      const isRoot = rootKey === key;
      const depth = computeDepth(key, rootKey, edges);
      const radius = getNodeRadius(isRoot);

      if (layoutItems.current.has(key) && !rootChanged) {
        const existing = layoutItems.current.get(key)!;
        next.set(key, {
          key,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          radius,
          depth,
          isGroup: false,
        });
      } else {
        let x: number;
        let y: number;
        if (isRoot) {
          x = cx;
          y = cy;
        } else {
          const sameDepthNodes = sortedNodeArray.filter(([k]) => computeDepth(k, rootKey, edges) === depth);
          const index = sameDepthNodes.findIndex(([k]) => k === key);
          const count = sameDepthNodes.length;
          const angleStep = (2 * Math.PI) / Math.max(count, 1);
          const baseAngle = depth === 1 ? -Math.PI / 2 : 0;
          const angle = baseAngle + angleStep * index;
          const dist = getDepthRadius(depth);
          x = cx + dist * Math.cos(angle);
          y = cy + dist * Math.sin(angle);
        }
        next.set(key, {
          key,
          x,
          y,
          vx: 0,
          vy: 0,
          radius,
          depth,
          isGroup: false,
        });
      }
    }

    for (const group of groupNodes) {
      const groupKey = group.key;
      const parentPos = next.get(group.parentKey) || layoutItems.current.get(group.parentKey);
      const depth = parentPos ? parentPos.depth + 1 : 2;
      const radius = getNodeRadius(false, true);

      if (layoutItems.current.has(groupKey) && !rootChanged) {
        const existing = layoutItems.current.get(groupKey)!;
        next.set(groupKey, {
          key: groupKey,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          radius,
          depth,
          isGroup: true,
          parentKey: group.parentKey,
        });
      } else if (parentPos) {
        const siblings = groupNodes.filter((g) => g.parentKey === group.parentKey);
        const index = siblings.indexOf(group);
        const angleStep = (Math.PI * 2) / Math.max(siblings.length, 1);
        const angle = angleStep * index - Math.PI / 2;
        const dist = getDepthRadius(depth);
        next.set(groupKey, {
          key: groupKey,
          x: parentPos.x + dist * Math.cos(angle),
          y: parentPos.y + dist * Math.sin(angle),
          vx: 0,
          vy: 0,
          radius,
          depth,
          isGroup: true,
          parentKey: group.parentKey,
        });
      }
    }

    layoutItems.current = next;

    const simulate = () => {
      const current = layoutItems.current;
      if (current.size === 0) return;

      const alpha = 0.1;
      const repulsionStrength = 4000;
      const attractionStrength = 0.002;
      const centerStrength = 0.004;
      const damping = 0.9;
      const maxVelocity = 8;

      const itemArr = Array.from(current.values());

      for (const item of itemArr) {
        item.vx *= damping;
        item.vy *= damping;
      }

      for (let i = 0; i < itemArr.length; i++) {
        for (let j = i + 1; j < itemArr.length; j++) {
          const a = itemArr[i];
          const b = itemArr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.radius + b.radius + 40;
          if (dist < minDist) {
            const force = (repulsionStrength * 2) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      for (const edge of edges) {
        const source = current.get(edge.source);
        const target = current.get(edge.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = getDepthRadius(target.depth) - getDepthRadius(source.depth) + 120;
        const force = (dist - Math.max(idealDist, 120)) * attractionStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      const currentRootKey = rootKey;
      for (const item of itemArr) {
        const isRoot = currentRootKey ? item.key === currentRootKey : false;
        if (!isRoot && !item.isGroup) {
          const targetRadius = getDepthRadius(item.depth);
          const dx = cx - item.x;
          const dy = cy - item.y;
          const currentDist = Math.sqrt(dx * dx + dy * dy) || 1;
          const distDiff = currentDist - targetRadius;
          item.vx += (dx / currentDist) * distDiff * centerStrength * 0.5;
          item.vy += (dy / currentDist) * distDiff * centerStrength * 0.5;
        }
      }

      for (const item of itemArr) {
        if (item.isGroup && item.parentKey) {
          const parent = current.get(item.parentKey);
          if (parent) {
            const dx = parent.x - item.x;
            const dy = parent.y - item.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = 100;
            const force = (dist - idealDist) * 0.01;
            item.vx += (dx / dist) * force;
            item.vy += (dy / dist) * force;
          }
        }
      }

      for (const item of itemArr) {
        const speed = Math.sqrt(item.vx * item.vx + item.vy * item.vy);
        if (speed > maxVelocity) {
          item.vx = (item.vx / speed) * maxVelocity;
          item.vy = (item.vy / speed) * maxVelocity;
        }
        item.x += item.vx * alpha;
        item.y += item.vy * alpha;

        item.x = Math.max(item.radius, Math.min(width - item.radius, item.x));
        item.y = Math.max(item.radius, Math.min(height - item.radius, item.y));
      }

      const newPositions = new Map<string, { x: number; y: number }>();
      for (const [key, item] of current) {
        newPositions.set(key, { x: item.x, y: item.y });
      }
      layoutStore.setPositions(newPositions);
    };

    if (layoutType === "force") {
      let iterations = 0;
      const maxIterations = 120;

      const runSimulation = () => {
        simulate();
        iterations++;
        if (iterations < maxIterations) {
          frameRef.current = requestAnimationFrame(runSimulation);
        }
      };
      frameRef.current = requestAnimationFrame(runSimulation);

      return () => {
        cancelAnimationFrame(frameRef.current);
      };
    } else {
      const newPositions = new Map<string, { x: number; y: number }>();

      if (rootKey) {
        newPositions.set(rootKey, { x: cx, y: cy });
      }

      const radialItems = Array.from(nodes.values()).filter((n) => getNodeKey(n) !== rootKey);
      const radialGroups = groupNodes.filter((g) => g.parentKey !== rootKey);

      const allRadial = [
        ...radialItems.map((n) => ({ key: getNodeKey(n), isGroup: false })),
        ...radialGroups.map((g) => ({ key: g.key, isGroup: true })),
      ];

      allRadial.sort((a, b) => {
        const depthA = computeDepth(a.key, rootKey, edges);
        const depthB = computeDepth(b.key, rootKey, edges);
        if (depthA !== depthB) return depthA - depthB;
        return sortKey(a.key) - sortKey(b.key);
      });

      const depthBuckets = new Map<number, typeof allRadial>();
      for (const item of allRadial) {
        const depth = computeDepth(item.key, rootKey, edges);
        const bucket = depthBuckets.get(depth) || [];
        bucket.push(item);
        depthBuckets.set(depth, bucket);
      }

      for (const [depth, items] of depthBuckets) {
        const angleStep = (2 * Math.PI) / Math.max(items.length, 1);
        const baseAngle = depth === 1 ? -Math.PI / 2 : 0;
        items.forEach((item, i) => {
          const angle = baseAngle + angleStep * i;
          const radius = getDepthRadius(depth);
          newPositions.set(item.key, {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
          });
        });
      }

      layoutStore.setPositions(newPositions);
    }
  }, [nodes, edges, groupNodes, rootKey, width, height, layoutType, cx, cy, getNodeRadius, getDepthRadius, sortKey]);

  const nodePositions = useMemo(() => {
    if (layoutType === "radial" && positions.size > 0 && (nodes.size > 0 || groupNodes.length > 0)) {
      const result = new Map<string, { x: number; y: number }>();
      for (const key of positions.keys()) {
        const pos = positions.get(key);
        if (pos) result.set(key, pos);
      }
      return result;
    }
    return positions;
  }, [positions, nodes, groupNodes, layoutType]);

  return { nodePositions };
}

function getNodeKey(node: GraphNode): string {
  return `${node.type}:${node.id}`;
}

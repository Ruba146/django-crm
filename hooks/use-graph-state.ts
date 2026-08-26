"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { GraphEdge, GraphNode } from "@/types/graph";

export interface GroupNode {
  key: string;
  parentKey: string;
  prefix: string;
  count: number;
  label: string;
}

export interface GraphState {
  rootNode: GraphNode | null;
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  groupNodes: GroupNode[];
  expandedNodes: Set<string>;
  expandedGroups: Map<string, Set<string>>;
  maxDepth: number;
  loadingNodes: Set<string>;
  loadingGroups: Map<string, Set<string>>;
  showLabels: boolean;
  layoutType: "force" | "radial";
  explorationPath: string[];
}

export interface GraphActions {
  setRootNode: (node: GraphNode | null) => void;
  setRootFromNode: (node: GraphNode) => void;
  setSelectedNode: (node: GraphNode | null) => void;
  setHoveredNode: (node: GraphNode | null) => void;
  expandNode: (node: GraphNode) => Promise<void>;
  focusNode: (node: GraphNode) => void;
  collapseNode: (node: GraphNode) => void;
  collapseBranch: (nodeKey: string) => void;
  expandGroup: (nodeKey: string, prefix: string) => void;
  collapseGroup: (nodeKey: string, prefix: string) => void;
  toggleLabels: () => void;
  setLayoutType: (type: "force" | "radial") => void;
  resetGraph: () => void;
  clearSelection: () => void;
}

const GROUP_THRESHOLD = 3;

function getNodeKey(node: GraphNode): string {
  return `${node.type}:${node.id}`;
}

function getRelationshipPrefix(relationship: string): string {
  return relationship.split("_")[0];
}

export function useGraphState(maxDepth = 3): [GraphState, GraphActions] {
  const [rootNode, setRootNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [nodes, setNodes] = useState<Map<string, GraphNode>>(new Map());
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [groupNodes, setGroupNodes] = useState<GroupNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Map<string, Set<string>>>(new Map());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState<Map<string, Set<string>>>(new Map());
  const [showLabels, setShowLabels] = useState(false);
  const [layoutType, setLayoutType] = useState<"force" | "radial">("radial");
  const [explorationPath, setExplorationPath] = useState<string[]>([]);

  const expandCache = useRef<Map<string, { edges: GraphEdge[]; nodes: GraphNode[] }>>(new Map());
  const prevRootKey = useRef<string | null>(null);
  const expandNodeRef = useRef<((node: GraphNode) => Promise<void>) | null>(null);

  const expandNode = useCallback(
    async (node: GraphNode) => {
      const key = getNodeKey(node);
      if (expandCache.current.has(key)) return;

      setExpandedNodes((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setLoadingNodes((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      try {
        const res = await fetch(`/api/graph/nodes?type=${node.type}&id=${node.id}&subgraph=true&depth=1`);
        if (!res.ok) return;
        const data = await res.json();

        const newEdges: GraphEdge[] = data.neighbors || [];
        const newNodes: GraphNode[] = data.neighborNodes || [];

        setNodes((prevNodes) => {
          const nodeMap = new Map(prevNodes);
          for (const n of newNodes) {
            nodeMap.set(getNodeKey(n), n);
          }
          return nodeMap;
        });

        setEdges((prevEdges) => {
          const edgeMap = new Map<string, GraphEdge>();
          for (const edge of [...prevEdges, ...newEdges]) {
            edgeMap.set(edge.id, edge);
          }
          return Array.from(edgeMap.values());
        });

        expandCache.current.set(key, { edges: newEdges, nodes: newNodes });

        const edgesByPrefix = new Map<string, GraphEdge[]>();
        for (const edge of newEdges) {
          const prefix = getRelationshipPrefix(edge.relationship);
          const existing = edgesByPrefix.get(prefix) || [];
          existing.push(edge);
          edgesByPrefix.set(prefix, existing);
        }

        const newGroupNodes: GroupNode[] = [];
        for (const [prefix, prefixEdges] of edgesByPrefix) {
          if (prefixEdges.length > GROUP_THRESHOLD) {
            newGroupNodes.push({
              key: `group:${key}:${prefix}`,
              parentKey: key,
              prefix,
              count: prefixEdges.length,
              label: prefix.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            });
          }
        }

        setGroupNodes((prev) => {
          const filtered = prev.filter((g) => g.parentKey !== key);
          return [...filtered, ...newGroupNodes];
        });
      } finally {
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    expandNodeRef.current = expandNode;
  }, [expandNode]);

  useEffect(() => {
    if (!rootNode) return;
    const key = getNodeKey(rootNode);
    if (prevRootKey.current !== key) {
      prevRootKey.current = key;
      setExplorationPath([key]);
      setSelectedNode(null);
      setHoveredNode(null);
      if (expandNodeRef.current) {
        expandNodeRef.current(rootNode);
      }
    }
  }, [rootNode]);

  const focusNode = useCallback(
    (node: GraphNode) => {
      const key = getNodeKey(node);
      setSelectedNode(node);

      setExplorationPath((prev) => {
        if (prev[prev.length - 1] === key) return prev;
        const next = [...prev];
        while (next.length > 0 && next[next.length - 1] !== key) {
          next.pop();
        }
        if (!next.includes(key)) {
          next.push(key);
        }
        return next;
      });

      if (!expandedNodes.has(key)) {
        const rootKey = rootNode ? getNodeKey(rootNode) : null;
        if (key !== rootKey) {
          expandNode(node);
        }
      }
    },
    [rootNode, expandedNodes, expandNode]
  );

  const setRootFromNode = useCallback(
    (node: GraphNode) => {
      setRootNode(node);
      setSelectedNode(null);
      setHoveredNode(null);
    },
    []
  );

  const collapseNode = useCallback(
    (node: GraphNode) => {
      const key = getNodeKey(node);
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      const descendants = new Set<string>();
      const queue = [key];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const cached = expandCache.current.get(current);
        if (cached) {
          for (const edge of cached.edges) {
            const neighborKey = edge.source === current ? edge.target : edge.source;
            if (neighborKey !== key && !descendants.has(neighborKey)) {
              descendants.add(neighborKey);
              queue.push(neighborKey);
            }
          }
        }
      }

      setEdges((prevEdges) => prevEdges.filter((e) => e.source !== key && e.target !== key && !descendants.has(e.source) && !descendants.has(e.target)));
      setNodes((prevNodes) => {
        const next = new Map(prevNodes);
        for (const desc of descendants) {
          next.delete(desc);
        }
        if (rootNode && key !== getNodeKey(rootNode)) {
          next.delete(key);
        }
        return next;
      });

      expandCache.current.delete(key);
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setGroupNodes((prev) => prev.filter((g) => g.parentKey !== key));

      if (selectedNode && getNodeKey(selectedNode) === key) {
        setSelectedNode(null);
      }
    },
    [rootNode, selectedNode]
  );

  const collapseBranch = useCallback(
    (nodeKey: string) => {
      const descendants = new Set<string>();
      const queue = [nodeKey];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const cached = expandCache.current.get(current);
        if (cached) {
          for (const edge of cached.edges) {
            const neighborKey = edge.source === current ? edge.target : edge.source;
            if (!descendants.has(neighborKey)) {
              descendants.add(neighborKey);
              queue.push(neighborKey);
            }
          }
        }
      }

      setEdges((prevEdges) =>
        prevEdges.filter((e) => {
          if (e.source === nodeKey || e.target === nodeKey) return false;
          if (descendants.has(e.source) || descendants.has(e.target)) return false;
          return true;
        })
      );
      setNodes((prevNodes) => {
        const next = new Map(prevNodes);
        for (const desc of descendants) {
          next.delete(desc);
        }
        return next;
      });

      for (const desc of descendants) {
        expandCache.current.delete(desc);
      }

      setExpandedNodes((prev) => {
        const next = new Set(prev);
        for (const desc of descendants) {
          next.delete(desc);
        }
        return next;
      });

      setExpandedGroups((prev) => {
        const next = new Map(prev);
        for (const desc of descendants) {
          next.delete(desc);
        }
        return next;
      });

      setGroupNodes((prev) => prev.filter((g) => !descendants.has(g.parentKey)));

      if (selectedNode && descendants.has(getNodeKey(selectedNode))) {
        setSelectedNode(null);
      }
    },
    [selectedNode]
  );

  const expandGroup = useCallback(
    (nodeKey: string, prefix: string) => {
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        const existing = next.get(nodeKey) || new Set<string>();
        const updated = new Set(existing);
        updated.add(prefix);
        next.set(nodeKey, updated);
        return next;
      });

      const cached = expandCache.current.get(nodeKey);
      if (cached) {
        const nodesToShow = new Set<string>();
        for (const edge of cached.edges) {
          if (getRelationshipPrefix(edge.relationship) === prefix) {
            const neighborKey = edge.source === nodeKey ? edge.target : edge.source;
            nodesToShow.add(neighborKey);
          }
        }

        setEdges((prevEdges) => {
          const edgeMap = new Map<string, GraphEdge>();
          for (const edge of prevEdges) {
            edgeMap.set(edge.id, edge);
          }
          for (const edge of cached.edges) {
            if (getRelationshipPrefix(edge.relationship) === prefix) {
              edgeMap.set(edge.id, edge);
            }
          }
          return Array.from(edgeMap.values());
        });

        setNodes((prevNodes) => {
          const next = new Map(prevNodes);
          for (const n of cached.nodes) {
            if (nodesToShow.has(getNodeKey(n))) {
              next.set(getNodeKey(n), n);
            }
          }
          return next;
        });
      }
    },
    []
  );

  const collapseGroup = useCallback(
    (nodeKey: string, prefix: string) => {
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        const existing = next.get(nodeKey);
        if (!existing) return prev;
        const updated = new Set(existing);
        updated.delete(prefix);
        if (updated.size === 0) {
          next.delete(nodeKey);
        } else {
          next.set(nodeKey, updated);
        }
        return next;
      });

      const cached = expandCache.current.get(nodeKey);
      if (cached) {
        const nodesToHide = new Set<string>();
        for (const edge of cached.edges) {
          if (getRelationshipPrefix(edge.relationship) === prefix) {
            const neighborKey = edge.source === nodeKey ? edge.target : edge.source;
            nodesToHide.add(neighborKey);
          }
        }

        setEdges((prevEdges) => prevEdges.filter((e) => {
          const edgePrefix = getRelationshipPrefix(e.relationship);
          if (edgePrefix !== prefix) return true;
          return e.source !== nodeKey && e.target !== nodeKey;
        }));

        setNodes((prevNodes) => {
          const next = new Map(prevNodes);
          for (const hideKey of nodesToHide) {
            next.delete(hideKey);
          }
          return next;
        });
      }
    },
    []
  );

  const resetGraph = useCallback(() => {
    setNodes(new Map());
    setEdges([]);
    setGroupNodes([]);
    setExpandedNodes(new Set());
    setExpandedGroups(new Map());
    setSelectedNode(null);
    setHoveredNode(null);
    setLoadingNodes(new Set());
    setLoadingGroups(new Map());
    expandCache.current.clear();
    prevRootKey.current = null;
    setExplorationPath([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  const toggleLabels = useCallback(() => {
    setShowLabels((prev) => !prev);
  }, []);

  const state: GraphState = {
    rootNode,
    selectedNode,
    hoveredNode,
    nodes,
    edges,
    groupNodes,
    expandedNodes,
    expandedGroups,
    maxDepth,
    loadingNodes,
    loadingGroups,
    showLabels,
    layoutType,
    explorationPath,
  };

  const actions: GraphActions = {
    setRootNode,
    setRootFromNode,
    setSelectedNode,
    setHoveredNode,
    expandNode,
    focusNode,
    collapseNode,
    collapseBranch,
    expandGroup,
    collapseGroup,
    toggleLabels,
    setLayoutType,
    resetGraph,
    clearSelection,
  };

  return [state, actions];
}

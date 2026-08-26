import { describe, it, expect } from "vitest";
import { getFixedGraphData, getGraphRecordsList, resolveNode, getNeighbors, getSubgraph } from "@/services/graph.service";

describe("Deal N.M integration", () => {
  const dealId = "629dbb4a-5c46-41af-a7ef-41034b2356d3";

  it("resolves Deal N.M", () => {
    const node = resolveNode("deal", dealId);
    expect(node).not.toBeNull();
    expect(node?.type).toBe("deal");
    expect(node?.label).toBe("N.M");
  });

  it("fixed graph includes task اتصال مهتم", () => {
    const data = getFixedGraphData("deal", dealId);
    expect(data).not.toBeNull();

    const taskNodes = data!.categories.tasks.nodes;
    expect(taskNodes.length).toBeGreaterThanOrEqual(1);

    const taskLabels = taskNodes.map((n) => n.label);
    expect(taskLabels).toContain("اتصال مهتم");
  });

  it("related counts match graph nodes", () => {
    const data = getFixedGraphData("deal", dealId);
    expect(data).not.toBeNull();

    const taskCategory = data!.categories.tasks;
    expect(taskCategory.totalCount).toBe(taskCategory.nodes.length);
    expect(taskCategory.totalCount).toBeGreaterThanOrEqual(1);
  });

  it("creates deal-to-task edge", () => {
    const edges = getSubgraph("deal", dealId, 2).edges;
    const dealTaskEdges = edges.filter((e) => e.relationship === "DEAL_HAS_TASK");
    expect(dealTaskEdges.length).toBeGreaterThanOrEqual(1);

    const taskIds = dealTaskEdges.map((e) => e.target);
    const hasExpectedTask = taskIds.some((t) => t === "task:61cc6915-4f03-447b-bf90-7535035a1067");
    expect(hasExpectedTask).toBe(true);
  });

  it("getNeighbors returns task for N.M", () => {
    const result = getNeighbors("deal", dealId);
    const taskNodes = result.nodes.filter((n) => n.type === "task");
    expect(taskNodes.length).toBeGreaterThanOrEqual(1);
    expect(taskNodes.some((n) => n.label === "اتصال مهتم")).toBe(true);
  });

  it("pagination returns unique records", () => {
    const page1 = getGraphRecordsList("leads", 1, 15);
    const page2 = getGraphRecordsList("leads", 2, 15);

    const ids1 = new Set(page1.records.map((r) => `${r.entityType}:${r.entityId}`));
    const ids2 = new Set(page2.records.map((r) => `${r.entityType}:${r.entityId}`));

    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it("no duplicates within a single page", () => {
    const result = getGraphRecordsList("deals", 1, 15);
    const ids = result.records.map((r) => `${r.entityType}:${r.entityId}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createMemory, deleteMemory, getMemories, getMemory, getNeighbors, getSubgraph, resolveNode, searchNodes, updateMemory, getFixedGraphData, getGraphRecordsList } from "@/services/graph.service";
import { initGraphTables } from "@/scripts/init-graph-tables";
import { getDb } from "@/lib/db";

describe("graph.service", () => {
  beforeEach(() => {
    initGraphTables();
    const db = getDb();
    db.prepare("DELETE FROM knowledge_graph_memories").run();
  });

  describe("resolveNode", () => {
    it("returns null for unknown type", () => {
      expect(resolveNode("customer", "nonexistent")).toBeNull();
    });

    it("resolves a real customer", () => {
      const node = resolveNode("customer", "6fad91d0-09f0-424d-b810-0225bd8f3192");
      expect(node).not.toBeNull();
      expect(node?.type).toBe("customer");
      expect(node?.label).toBe("الشنقيطي للاتصالات");
    });

    it("resolves a real lead", () => {
      const node = resolveNode("lead", "6831e382-7148-4c0a-8f2a-a81ee6d5526f");
      expect(node).not.toBeNull();
      expect(node?.type).toBe("lead");
      expect(node?.label).toBe("عبدالملك الرزامي");
    });

    it("resolves a real deal", () => {
      const node = resolveNode("deal", "fa74cd4e-80f8-4139-aefc-2215949a6c4f");
      expect(node).not.toBeNull();
      expect(node?.type).toBe("deal");
      expect(node?.label).toBe("محمد السالم");
    });

    it("resolves a real note", () => {
      const note = getDb().prepare("SELECT id FROM notes LIMIT 1").get() as { id: string } | undefined;
      if (!note) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("note", note.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("note");
    });

    it("resolves a real source", () => {
      const source = getDb().prepare("SELECT id FROM sources LIMIT 1").get() as { id: string } | undefined;
      if (!source) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("source", source.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("source");
    });

    it("resolves a real stage", () => {
      const stage = getDb().prepare("SELECT id FROM pipeline_stages LIMIT 1").get() as { id: string } | undefined;
      if (!stage) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("stage", stage.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("stage");
    });

    it("resolves a real industry", () => {
      const industry = getDb().prepare("SELECT id FROM industries LIMIT 1").get() as { id: string } | undefined;
      if (!industry) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("industry", industry.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("industry");
    });

    it("resolves a real event", () => {
      const event = getDb().prepare("SELECT id FROM crm_events LIMIT 1").get() as { id: string } | undefined;
      if (!event) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("event", event.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("event");
    });

    it("resolves a real task_type", () => {
      const taskType = getDb().prepare("SELECT id FROM task_types LIMIT 1").get() as { id: string } | undefined;
      if (!taskType) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("task_type", taskType.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("task_type");
    });

    it("resolves a real activity_type", () => {
      const activityType = getDb().prepare("SELECT id FROM activity_types LIMIT 1").get() as { id: string } | undefined;
      if (!activityType) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("activity_type", activityType.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("activity_type");
    });

    it("resolves a real lost_reason", () => {
      const lostReason = getDb().prepare("SELECT id FROM lost_reasons LIMIT 1").get() as { id: string } | undefined;
      if (!lostReason) {
        expect(true).toBe(true);
        return;
      }
      const node = resolveNode("lost_reason", lostReason.id);
      expect(node).not.toBeNull();
      expect(node?.type).toBe("lost_reason");
    });
  });

  describe("getNeighbors", () => {
    it("returns empty arrays for a non-existent node", () => {
      const result = getNeighbors("customer", "nonexistent");
      expect(result.edges).toEqual([]);
      expect(result.nodes).toEqual([]);
    });

    it("returns real relationships for a real customer", () => {
      const result = getNeighbors("customer", "6fad91d0-09f0-424d-b810-0225bd8f3192");
      expect(result.nodes.length).toBeGreaterThan(0);
      const types = new Set(result.nodes.map((n) => n.type));
      expect(types.has("lead") || types.has("deal") || types.has("contact")).toBe(true);
    });

    it("returns real relationships for a real lead", () => {
      const result = getNeighbors("lead", "6831e382-7148-4c0a-8f2a-a81ee6d5526f");
      expect(result.nodes.length).toBeGreaterThan(0);
      const types = new Set(result.nodes.map((n) => n.type));
      expect(types.has("customer") || types.has("deal") || types.has("user")).toBe(true);
    });

    it("returns real relationships for a real deal", () => {
      const result = getNeighbors("deal", "fa74cd4e-80f8-4139-aefc-2215949a6c4f");
      expect(result.nodes.length).toBeGreaterThan(0);
      const types = new Set(result.nodes.map((n) => n.type));
      expect(types.has("lead") || types.has("customer") || types.has("user")).toBe(true);
    });

    it("connects deal to its stage", () => {
      const result = getNeighbors("deal", "fa74cd4e-80f8-4139-aefc-2215949a6c4f");
      const stageNodes = result.nodes.filter((n) => n.type === "stage");
      expect(stageNodes.length).toBeGreaterThan(0);
    });

    it("connects lead to its source", () => {
      const result = getNeighbors("lead", "6831e382-7148-4c0a-8f2a-a81ee6d5526f");
      const sourceNodes = result.nodes.filter((n) => n.type === "source");
      expect(sourceNodes.length).toBeGreaterThan(0);
    });

    it("connects customer to its industry", () => {
      const result = getNeighbors("customer", "6fad91d0-09f0-424d-b810-0225bd8f3192");
      const industryNodes = result.nodes.filter((n) => n.type === "industry");
      expect(industryNodes.length).toBeGreaterThan(0);
    });

    it("connects notes to their parent record", () => {
      const note = getDb().prepare("SELECT id, entity_type, entity_id FROM notes LIMIT 1").get() as { id: string; entity_type: string; entity_id: string } | undefined;
      if (!note) {
        expect(true).toBe(true);
        return;
      }
      const result = getNeighbors("note", note.id);
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  describe("getSubgraph", () => {
    it("returns empty for non-existent node", () => {
      const result = getSubgraph("customer", "nonexistent");
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it("returns connected graph for a real deal", () => {
      const result = getSubgraph("deal", "fa74cd4e-80f8-4139-aefc-2215949a6c4f", 2);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });
  });

  describe("searchNodes", () => {
    it("returns empty array for empty query", () => {
      expect(searchNodes("")).toEqual([]);
    });

    it("returns results for a non-empty query", () => {
      const result = searchNodes("a");
      expect(Array.isArray(result)).toBe(true);
    });

    it("includes notes in search results", () => {
      const noteCount = (getDb().prepare("SELECT COUNT(*) as c FROM notes").get() as { c: number }).c;
      if (noteCount === 0) {
        expect(true).toBe(true);
        return;
      }
      const sample = getDb().prepare("SELECT id, body FROM notes LIMIT 1").get() as { id: string; body: string } | undefined;
      if (!sample) {
        expect(true).toBe(true);
        return;
      }
      const term = sample.body.slice(0, 4);
      const result = searchNodes(term);
      const noteResults = result.filter((r) => r.type === "note");
      expect(noteResults.length).toBeGreaterThan(0);
    });

    it("includes sources in search results", () => {
      const sourceCount = (getDb().prepare("SELECT COUNT(*) as c FROM sources").get() as { c: number }).c;
      if (sourceCount === 0) {
        expect(true).toBe(true);
        return;
      }
      const source = getDb().prepare("SELECT label FROM sources LIMIT 1").get() as { label: string } | undefined;
      if (!source) {
        expect(true).toBe(true);
        return;
      }

      const result = searchNodes(source.label);
      const sourceResults = result.filter((r) => r.type === "source");
      expect(sourceResults.length).toBeGreaterThan(0);
    });

    it("includes stages in search results", () => {
      const stageCount = (getDb().prepare("SELECT COUNT(*) as c FROM pipeline_stages").get() as { c: number }).c;
      if (stageCount === 0) {
        expect(true).toBe(true);
        return;
      }
      const stage = getDb().prepare("SELECT label FROM pipeline_stages LIMIT 1").get() as { label: string } | undefined;
      if (!stage) {
        expect(true).toBe(true);
        return;
      }
      const result = searchNodes(stage.label);
      const stageResults = result.filter((r) => r.type === "stage");
      expect(stageResults.length).toBeGreaterThan(0);
    });
  });

  describe("memory CRUD", () => {
    it("creates a memory and retrieves it", () => {
      const created = createMemory({
        entity_type: "customer",
        entity_id: "cust-1",
        memory_type: "note",
        content: "Test memory",
        source: "Test",
      });
      expect(created.id).toBeTruthy();
      expect(created.content).toBe("Test memory");

      const fetched = getMemory(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.content).toBe("Test memory");
    });

    it("lists memories for an entity", () => {
      createMemory({
        entity_type: "customer",
        entity_id: "cust-1",
        memory_type: "decision",
        content: "Decision A",
      });
      createMemory({
        entity_type: "customer",
        entity_id: "cust-1",
        memory_type: "context",
        content: "Context B",
      });
      createMemory({
        entity_type: "lead",
        entity_id: "lead-1",
        memory_type: "note",
        content: "Lead note",
      });

      const memories = getMemories("customer", "cust-1");
      expect(memories).toHaveLength(2);
      expect(memories.map((m) => m.content).sort()).toEqual(["Context B", "Decision A"]);
    });

    it("updates a memory", () => {
      const created = createMemory({
        entity_type: "customer",
        entity_id: "cust-1",
        memory_type: "note",
        content: "Original",
      });

      const updated = updateMemory(created.id, { content: "Updated", memory_type: "decision" });
      expect(updated?.content).toBe("Updated");
      expect(updated?.memory_type).toBe("decision");
    });

    it("deletes a memory", () => {
      const created = createMemory({
        entity_type: "customer",
        entity_id: "cust-1",
        memory_type: "note",
        content: "To delete",
      });

      const deleted = deleteMemory(created.id);
      expect(deleted).toBe(true);
      expect(getMemory(created.id)).toBeNull();
    });

    it("returns null for non-existent memory", () => {
      expect(getMemory("nonexistent")).toBeNull();
    });

    it("returns false when deleting non-existent memory", () => {
      expect(deleteMemory("nonexistent")).toBe(false);
    });
  });

  describe("getFixedGraphData", () => {
    it("returns null for non-existent node", () => {
      expect(getFixedGraphData("deal", "nonexistent")).toBeNull();
    });

    it("includes related tasks for a real deal with tasks", () => {
      const data = getFixedGraphData("deal", "629dbb4a-5c46-41af-a7ef-41034b2356d3");
      expect(data).not.toBeNull();
      expect(data!.root.type).toBe("deal");

      const taskCategory = data!.categories.tasks;
      expect(taskCategory.totalCount).toBeGreaterThanOrEqual(1);

      const taskLabels = taskCategory.nodes.map((n) => n.label);
      expect(taskLabels).toContain("اتصال مهتم");
    });

    it("does not duplicate task nodes in fixed graph", () => {
      const data = getFixedGraphData("deal", "629dbb4a-5c46-41af-a7ef-41034b2356d3");
      expect(data).not.toBeNull();

      const allNodes = data!.categories.tasks.nodes;
      const ids = allNodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("creates deal-to-task edges in subgraph", () => {
      const subgraph = getSubgraph("deal", "629dbb4a-5c46-41af-a7ef-41034b2356d3", 2);
      const taskNodes = subgraph.nodes.filter((n) => n.type === "task");
      expect(taskNodes.length).toBeGreaterThanOrEqual(1);

      const dealTaskEdges = subgraph.edges.filter((e) => e.relationship === "DEAL_HAS_TASK");
      expect(dealTaskEdges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getGraphRecordsList pagination", () => {
    it("returns paginated leads without duplicates", () => {
      const page1 = getGraphRecordsList("leads", 1, 15);
      expect(page1.records.length).toBeLessThanOrEqual(15);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(15);

      const page2 = getGraphRecordsList("leads", 2, 15);
      expect(page2.records.length).toBeLessThanOrEqual(15);
      expect(page2.page).toBe(2);

      const page1Ids = new Set(page1.records.map((r) => `${r.entityType}:${r.entityId}`));
      for (const rec of page2.records) {
        expect(page1Ids.has(`${rec.entityType}:${rec.entityId}`)).toBe(false);
      }
    });

    it("returns paginated deals without duplicates", () => {
      const page1 = getGraphRecordsList("deals", 1, 15);
      expect(page1.records.length).toBeLessThanOrEqual(15);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(15);

      const page2 = getGraphRecordsList("deals", 2, 15);
      expect(page2.records.length).toBeLessThanOrEqual(15);
      expect(page2.page).toBe(2);

      const page1Ids = new Set(page1.records.map((r) => `${r.entityType}:${r.entityId}`));
      for (const rec of page2.records) {
        expect(page1Ids.has(`${rec.entityType}:${rec.entityId}`)).toBe(false);
      }
    });

    it("returns correct total and totalPages for leads", () => {
      const result = getGraphRecordsList("leads", 1, 15);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.totalPages).toBe(Math.max(1, Math.ceil(result.total / 15)));
    });

    it("returns correct total and totalPages for deals", () => {
      const result = getGraphRecordsList("deals", 1, 15);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.totalPages).toBe(Math.max(1, Math.ceil(result.total / 15)));
    });

    it("returns unique records within a single page", () => {
      const result = getGraphRecordsList("leads", 1, 15);
      const ids = result.records.map((r) => `${r.entityType}:${r.entityId}`);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});


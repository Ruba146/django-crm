import { describe, it, expect, beforeEach } from "vitest";
import {
  compileProcess,
  evaluateCondition,
  createProcessDefinition,
  getProcessDefinition,
  getProcessDefinitions,
  updateProcessDefinition,
  deleteProcessDefinition,
  startProcess,
  getProcessInstance,
  getProcessInstances,
  executeStep,
  executeProcess,
  cancelProcess,
  initProcessTables,
} from "@/services/process.service";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

describe("process.service", () => {
  beforeEach(() => {
    initProcessTables();
    const db = getDb();
    db.prepare("DELETE FROM process_executions").run();
    db.prepare("DELETE FROM process_instances").run();
    db.prepare("DELETE FROM process_definitions").run();
    db.prepare("DELETE FROM crm_events").run();
  });

  describe("evaluateCondition", () => {
    it("evaluates greater than", () => {
      const result = evaluateCondition("value > 100", { value: 150 });
      expect(result.passed).toBe(true);
    });

    it("evaluates less than", () => {
      const result = evaluateCondition("value < 100", { value: 50 });
      expect(result.passed).toBe(true);
    });

    it("evaluates equality", () => {
      const result = evaluateCondition("status == approved", { status: "approved" });
      expect(result.passed).toBe(true);
    });

    it("evaluates inequality", () => {
      const result = evaluateCondition("status != rejected", { status: "approved" });
      expect(result.passed).toBe(true);
    });

    it("evaluates contains", () => {
      const result = evaluateCondition("name contains test", { name: "this is a test" });
      expect(result.passed).toBe(true);
    });

    it("handles missing field", () => {
      const result = evaluateCondition("missing > 100", {});
      expect(result.passed).toBe(false);
    });
  });

  describe("compileProcess", () => {
    it("compiles a valid process", () => {
      const definition = createProcessDefinition({
        name: "Test Process",
        trigger: { type: "manual" },
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "end", type: "completion", name: "End", config: {} },
        ],
        edges: [
          { id: "e1", source: "start", target: "end" },
        ],
      });

      const result = compileProcess(definition);
      expect(result.success).toBe(true);
      expect(result.process).toBeDefined();
      expect(result.process!.triggerNode).not.toBeNull();
      expect(result.process!.triggerNode!.id).toBe("start");
      expect(result.process!.terminalNodes.has("end")).toBe(true);
    });

    it("rejects process without trigger", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "end", type: "completion", name: "End", config: {} },
        ],
        edges: [],
      });

      const result = compileProcess(definition);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects process with duplicate node ids", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
          { id: "start", type: "trigger", name: "Start 2", config: {} },
        ],
        edges: [],
      });

      const result = compileProcess(definition);
      expect(result.success).toBe(false);
    });

    it("rejects process with unknown edge target", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "start", type: "trigger", name: "Start", config: {} },
        ],
        edges: [
          { id: "e1", source: "start", target: "nonexistent" },
        ],
      });

      const result = compileProcess(definition);
      expect(result.success).toBe(false);
    });
  });

  describe("process CRUD", () => {
    it("creates and retrieves a process definition", () => {
      const created = createProcessDefinition({
        name: "Deal Approval",
        description: "Approves deals over 100k",
        trigger: { type: "event", eventType: "STAGE_CHANGED", entityType: "deal" },
        nodes: [
          { id: "trigger", type: "trigger", name: "Deal Stage Changed", config: {} },
          { id: "check_value", type: "condition", name: "Check Value", config: { expression: "deal.value > 100000", trueTarget: "approve", falseTarget: "complete" } },
          { id: "approve", type: "action", name: "Create Approval Task", config: { type: "create_task", params: { title: "Approve deal" }, next: "complete" } },
          { id: "complete", type: "completion", name: "Done", config: {} },
        ],
        edges: [
          { id: "e1", source: "trigger", target: "check_value" },
          { id: "e2", source: "approve", target: "complete" },
        ],
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Deal Approval");

      const retrieved = getProcessDefinition(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe("Deal Approval");
      expect(retrieved!.nodes).toHaveLength(4);
    });

    it("lists process definitions", () => {
      createProcessDefinition({ name: "P1", trigger: { type: "manual" }, nodes: [{ id: "t", type: "trigger", name: "T", config: {} }], edges: [] });
      createProcessDefinition({ name: "P2", trigger: { type: "manual" }, nodes: [{ id: "t", type: "trigger", name: "T", config: {} }], edges: [] });

      const all = getProcessDefinitions();
      expect(all).toHaveLength(2);
    });

    it("updates a process definition", () => {
      const created = createProcessDefinition({ name: "Original", trigger: { type: "manual" }, nodes: [{ id: "t", type: "trigger", name: "T", config: {} }], edges: [] });
      const updated = updateProcessDefinition(created.id, { name: "Updated" });
      expect(updated!.name).toBe("Updated");
    });

    it("deletes a process definition", () => {
      const created = createProcessDefinition({ name: "To Delete", trigger: { type: "manual" }, nodes: [{ id: "t", type: "trigger", name: "T", config: {} }], edges: [] });
      const deleted = deleteProcessDefinition(created.id);
      expect(deleted).toBe(true);
      expect(getProcessDefinition(created.id)).toBeNull();
    });
  });

  describe("process instances", () => {
    it("starts a process instance", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "c", type: "completion", name: "C", config: {} },
        ],
        edges: [{ id: "e", source: "t", target: "c" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      expect(instance.id).toBeDefined();
      expect(instance.status).toBe("running");
      expect(instance.currentNodeId).toBe("t");
    });

    it("retrieves a process instance", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "c", type: "completion", name: "C", config: {} },
        ],
        edges: [{ id: "e", source: "t", target: "c" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const retrieved = getProcessInstance(instance.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.entityType).toBe("deal");
    });

    it("lists process instances with filters", () => {
      const definition = createProcessDefinition({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "c", type: "completion", name: "C", config: {} },
        ],
        edges: [{ id: "e", source: "t", target: "c" }],
      });

      startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      startProcess({ definitionId: definition.id, entityType: "lead", entityId: "lead-1" });

      const dealInstances = getProcessInstances({ entityType: "deal" });
      expect(dealInstances).toHaveLength(1);
      expect(dealInstances[0].entityId).toBe("deal-1");
    });
  });

  describe("process execution", () => {
    it("executes a simple process to completion", () => {
      const definition = createProcessDefinition({
        name: "Simple",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "c", type: "completion", name: "C", config: {} },
        ],
        edges: [{ id: "e", source: "t", target: "c" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const executions = executeProcess(instance.id);

      const updated = getProcessInstance(instance.id);
      expect(updated!.status).toBe("completed");
      expect(executions.length).toBeGreaterThanOrEqual(2);
    });

    it("executes a condition node", () => {
      const definition = createProcessDefinition({
        name: "Conditional",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "check", type: "condition", name: "Check", config: { expression: "variables.value > 100", trueTarget: "high", falseTarget: "low" } },
          { id: "high", type: "completion", name: "High", config: {} },
          { id: "low", type: "completion", name: "Low", config: {} },
        ],
        edges: [
          { id: "e1", source: "t", target: "check" },
        ],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1", context: { value: 150 } });
      const executions = executeProcess(instance.id);
      const updated = getProcessInstance(instance.id);
      expect(updated!.status).toBe("completed");
    });

    it("executes an action node", () => {
      const definition = createProcessDefinition({
        name: "Action",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "act", type: "action", name: "Create Task", config: { type: "create_task", params: { title: "Process Task" }, next: "end" } },
          { id: "end", type: "completion", name: "End", config: {} },
        ],
        edges: [{ id: "e1", source: "t", target: "act" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const executions = executeProcess(instance.id);
      const updated = getProcessInstance(instance.id);
      expect(updated!.status).toBe("completed");
      expect(executions.some((e) => e.nodeId === "act" && e.status === "completed")).toBe(true);
    });

    it("handles wait nodes", () => {
      const definition = createProcessDefinition({
        name: "Wait",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "w", type: "wait", name: "Wait", config: { durationSeconds: 3600, next: "end" } },
          { id: "end", type: "completion", name: "End", config: {} },
        ],
        edges: [{ id: "e1", source: "t", target: "w" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const executions = executeProcess(instance.id);
      const updated = getProcessInstance(instance.id);
      expect(updated!.status).toBe("waiting");
      expect(updated!.currentNodeId).toBe("end");
    });

    it("handles failure nodes", () => {
      const definition = createProcessDefinition({
        name: "Fail",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "fail", type: "failure", name: "Fail", config: { reason: "Something went wrong" } },
        ],
        edges: [{ id: "e1", source: "t", target: "fail" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const executions = executeProcess(instance.id);
      const updated = getProcessInstance(instance.id);
      expect(updated!.status).toBe("failed");
    });

    it("cancels a running process", () => {
      const definition = createProcessDefinition({
        name: "Cancel",
        trigger: { type: "manual" },
        nodes: [
          { id: "t", type: "trigger", name: "T", config: {} },
          { id: "c", type: "completion", name: "C", config: {} },
        ],
        edges: [{ id: "e", source: "t", target: "c" }],
      });

      const instance = startProcess({ definitionId: definition.id, entityType: "deal", entityId: "deal-1" });
      const cancelled = cancelProcess(instance.id);
      expect(cancelled!.status).toBe("cancelled");
    });
  });
});

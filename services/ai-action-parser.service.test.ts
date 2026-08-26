import { describe, it, expect } from "vitest";
import { parseActionsFromResponse, stripActionMarkers, validateAction } from "@/services/ai-action-parser.service";
import type { AIAction, PageContext } from "@/types/ai-chat";

const mockContext: PageContext = {
  page: "customers",
  route: "/customers",
  recordId: "cust-123",
  recordType: "customer",
  recordName: "Acme Corp",
};

describe("parseActionsFromResponse", () => {
  it("returns empty array when no ACTION_JSON marker is present", () => {
    const result = parseActionsFromResponse("Hello, how can I help?", mockContext);
    expect(result).toEqual([]);
  });

  it("parses a single ACTION_JSON block", () => {
    const text = "I will create a task for you. <!-- ACTION_JSON:{\"type\":\"create_task\",\"label\":\"Call Ahmed\",\"params\":{\"title\":\"Call Ahmed\",\"due_at\":\"2024-01-15T10:00:00Z\"}} -->";
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("create_task");
    expect(result[0].label).toBe("Call Ahmed");
    expect(result[0].params.title).toBe("Call Ahmed");
  });

  it("ignores invalid action types", () => {
    const text = "<!-- ACTION_JSON:{\"type\":\"delete_everything\",\"params\":{}} -->";
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(0);
  });

  it("ignores malformed JSON", () => {
    const text = "<!-- ACTION_JSON:{not valid json} -->";
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(0);
  });

  it("injects context entity_type and entity_id for context-aware actions", () => {
    const text = "<!-- ACTION_JSON:{\"type\":\"create_task\",\"label\":\"Follow up\",\"params\":{\"title\":\"Follow up\"}} -->";
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(1);
    expect(result[0].params.entity_type).toBe("customer");
    expect(result[0].params.entity_id).toBe("cust-123");
  });

  it("does not inject context for create_lead", () => {
    const text = "<!-- ACTION_JSON:{\"type\":\"create_lead\",\"label\":\"New lead\",\"params\":{\"full_name\":\"John\"}} -->";
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(1);
    expect(result[0].params.entity_type).toBeUndefined();
    expect(result[0].params.entity_id).toBeUndefined();
  });

  it("parses multiple ACTION_JSON blocks", () => {
    const text = `
      First action.
      <!-- ACTION_JSON:{"type":"create_task","label":"Task 1","params":{"title":"Task 1"}} -->
      Second action.
      <!-- ACTION_JSON:{"type":"create_note","label":"Note 1","params":{"body":"Note body"}} -->
    `;
    const result = parseActionsFromResponse(text, mockContext);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("create_task");
    expect(result[1].type).toBe("create_note");
  });
});

describe("stripActionMarkers", () => {
  it("removes ACTION_JSON markers from text", () => {
    const text = "Hello <!-- ACTION_JSON:{\"type\":\"create_task\"} --> world";
    const result = stripActionMarkers(text);
    expect(result).toBe("Hello world");
  });

  it("removes multiple ACTION_JSON markers", () => {
    const text = "A <!-- ACTION_JSON:{\"type\":\"create_task\"} --> B <!-- ACTION_JSON:{\"type\":\"create_note\"} --> C";
    const result = stripActionMarkers(text);
    expect(result).toBe("A B C");
  });

  it("handles text without markers", () => {
    const text = "Hello world";
    const result = stripActionMarkers(text);
    expect(result).toBe("Hello world");
  });
});

describe("validateAction", () => {
  it("returns null for valid create_task", () => {
    const action: AIAction = {
      id: "1",
      type: "create_task",
      label: "Task",
      params: { title: "Call Ahmed" },
    };
    expect(validateAction(action)).toBeNull();
  });

  it("returns error for missing required field", () => {
    const action: AIAction = {
      id: "1",
      type: "create_lead",
      label: "Lead",
      params: {},
    };
    const result = validateAction(action);
    expect(result).toContain("full_name");
  });

  it("returns error for invalid entity_type", () => {
    const action: AIAction = {
      id: "1",
      type: "assign_owner",
      label: "Assign",
      params: { entity_type: "invalid", entity_id: "123", owner_id: "456" },
    };
    const result = validateAction(action);
    expect(result).toContain("Invalid entity_type");
  });

  it("returns error for missing entity_id on context-aware actions", () => {
    const action: AIAction = {
      id: "1",
      type: "assign_owner",
      label: "Assign",
      params: { entity_type: "customer", owner_id: "456" },
    };
    const result = validateAction(action);
    expect(result).toContain("entity_id");
  });

  it("returns error for missing entity_type on assign_owner", () => {
    const action: AIAction = {
      id: "1",
      type: "assign_owner",
      label: "Assign",
      params: { entity_id: "123", owner_id: "456" },
    };
    const result = validateAction(action);
    expect(result).toContain("entity_type");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { countEvents, getEntityEvents, getEvent, getEventsByType, getEventsInRange, recordEvent } from "@/services/event.service";
import { initEventTables } from "@/scripts/init-event-tables";
import { getDb } from "@/lib/db";

describe("event.service", () => {
  beforeEach(() => {
    initEventTables();
    const db = getDb();
    db.prepare("DELETE FROM crm_events").run();
  });

  describe("recordEvent", () => {
    it("creates an event with minimal input", () => {
      const event = recordEvent({
        event_type: "ENTITY_CREATED",
        entity_type: "deal",
        entity_id: "deal-1",
      });

      expect(event.id).toBeDefined();
      expect(event.event_type).toBe("ENTITY_CREATED");
      expect(event.entity_type).toBe("deal");
      expect(event.entity_id).toBe("deal-1");
      expect(event.timestamp).toBeDefined();
    });

    it("stores previous_state and new_state", () => {
      const event = recordEvent({
        event_type: "STAGE_CHANGED",
        entity_type: "deal",
        entity_id: "deal-1",
        previous_state: { stage_id: "stage-1" },
        new_state: { stage_id: "stage-2" },
      });

      expect(event.previous_state).toEqual({ stage_id: "stage-1" });
      expect(event.new_state).toEqual({ stage_id: "stage-2" });
    });

    it("stores correlation_id and source", () => {
      const event = recordEvent({
        event_type: "ENTITY_CREATED",
        entity_type: "lead",
        entity_id: "lead-1",
        correlation_id: "corr-123",
        source: "ai_action",
      });

      expect(event.correlation_id).toBe("corr-123");
      expect(event.source).toBe("ai_action");
    });
  });

  describe("getEvent", () => {
    it("returns null for missing event", () => {
      expect(getEvent("nonexistent")).toBeNull();
    });

    it("returns the event by id", () => {
      const created = recordEvent({
        event_type: "ENTITY_CREATED",
        entity_type: "deal",
        entity_id: "deal-1",
      });

      const fetched = getEvent(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.event_type).toBe("ENTITY_CREATED");
    });
  });

  describe("getEntityEvents", () => {
    it("returns empty array for entity with no events", () => {
      const events = getEntityEvents("deal", "nonexistent");
      expect(events).toEqual([]);
    });

    it("returns events for an entity", async () => {
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-1" });
      await new Promise((r) => setTimeout(r, 10));
      recordEvent({ event_type: "STAGE_CHANGED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-2" });

      const events = getEntityEvents("deal", "deal-1");
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.event_type)).toContain("STAGE_CHANGED");
      expect(events.map((e) => e.event_type)).toContain("DEAL_CREATED");
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        recordEvent({ event_type: "ENTITY_UPDATED", entity_type: "deal", entity_id: "deal-1" });
      }
      const events = getEntityEvents("deal", "deal-1", 3);
      expect(events).toHaveLength(3);
    });
  });

  describe("getEventsByType", () => {
    it("returns events filtered by type", () => {
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "STAGE_CHANGED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-2" });

      const events = getEventsByType("DEAL_CREATED", 10);
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.event_type === "DEAL_CREATED")).toBe(true);
    });
  });

  describe("getEventsInRange", () => {
    it("filters by entity_type and entity_id", () => {
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "LEAD_CREATED", entity_type: "lead", entity_id: "lead-1" });

      const events = getEventsInRange({ entity_type: "deal", entity_id: "deal-1" });
      expect(events).toHaveLength(1);
      expect(events[0].entity_type).toBe("deal");
    });

    it("supports pagination via limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        recordEvent({ event_type: "ENTITY_UPDATED", entity_type: "deal", entity_id: "deal-1" });
      }
      const page1 = getEventsInRange({ entity_type: "deal", entity_id: "deal-1", limit: 2, offset: 0 });
      const page2 = getEventsInRange({ entity_type: "deal", entity_id: "deal-1", limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe("countEvents", () => {
    it("counts matching events", () => {
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "STAGE_CHANGED", entity_type: "deal", entity_id: "deal-1" });
      recordEvent({ event_type: "DEAL_CREATED", entity_type: "deal", entity_id: "deal-2" });

      expect(countEvents({ entity_type: "deal" })).toBe(3);
      expect(countEvents({ entity_type: "deal", entity_id: "deal-1" })).toBe(2);
      expect(countEvents({ event_type: "DEAL_CREATED" })).toBe(2);
    });
  });

  describe("ordering", () => {
    it("returns events in chronological order", async () => {
      const id1 = recordEvent({ event_type: "ENTITY_CREATED", entity_type: "deal", entity_id: "deal-1" });
      await new Promise((r) => setTimeout(r, 10));
      const id2 = recordEvent({ event_type: "ENTITY_UPDATED", entity_type: "deal", entity_id: "deal-1" });

      const events = getEntityEvents("deal", "deal-1");
      expect(events[0].id).toBe(id1.id);
      expect(events[1].id).toBe(id2.id);
    });
  });
});

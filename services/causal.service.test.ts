import { describe, it, expect, beforeEach } from "vitest";
import { analyzeCausality } from "@/services/causal.service";
import { initEventTables } from "@/scripts/init-event-tables";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

describe("causal.service", () => {
  beforeEach(() => {
    initEventTables();
    const db = getDb();
    db.prepare("DELETE FROM crm_events").run();
  });

  function insertEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    timestamp: string,
    previousState: Record<string, unknown> | null = null,
    newState: Record<string, unknown> | null = null,
    actorId: string | null = null
  ): string {
    const db = getDb();
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      eventType,
      entityType,
      entityId,
      actorId,
      timestamp,
      null,
      previousState ? JSON.stringify(previousState) : null,
      newState ? JSON.stringify(newState) : null,
      null,
      "ui"
    );
    return id;
  }

  describe("analyzeCausality", () => {
    it("returns empty chains when no state-change events exist", () => {
      const result = analyzeCausality({ entityType: "deal", entityId: "deal-1" });
      expect(result.chains).toEqual([]);
      expect(result.summary).toContain("No state-change events found");
    });

    it("returns a direct_cause chain when previous_state and new_state are present", () => {
      const now = new Date().toISOString();
      insertEvent("STAGE_CHANGED", "deal", "deal-1", now, { stage_id: "stage-1", stage_label: "Qualified" }, { stage_id: "stage-2", stage_label: "Proposal" });

      const result = analyzeCausality({ entityType: "deal", entityId: "deal-1" });
      expect(result.chains.length).toBeGreaterThanOrEqual(1);
      expect(result.chains[0].chain[0].linkType).toBe("direct_cause");
      expect(result.chains[0].confidence).toBe("certain");
      expect(result.chains[0].evidence.length).toBeGreaterThanOrEqual(1);
    });

    it("detects owner_effect when owner change precedes stage change", () => {
      const now = new Date().toISOString();
      const earlier = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      insertEvent("OWNER_CHANGED", "deal", "deal-1", earlier, { owner_id: "user-old" }, { owner_id: "user-new" });
      insertEvent("ACTIVITY_CREATED", "deal", "deal-1", now);
      insertEvent("STAGE_CHANGED", "deal", "deal-1", now, { stage_id: "stage-1" }, { stage_id: "stage-2" });

      const result = analyzeCausality({ entityType: "deal", entityId: "deal-1" });
      const ownerEffectChain = result.chains.find((c) => c.chain.some((l) => l.linkType === "owner_effect"));
      expect(ownerEffectChain).toBeDefined();
      expect(ownerEffectChain!.confidence).toBe("likely");
    });

    it("returns structured evidence for every chain", () => {
      const now = new Date().toISOString();
      insertEvent("STAGE_CHANGED", "deal", "deal-1", now, { stage_id: "stage-1" }, { stage_id: "stage-2" });

      const result = analyzeCausality({ entityType: "deal", entityId: "deal-1" });
      for (const chain of result.chains) {
        expect(chain.id).toBeTruthy();
        expect(chain.targetEventId).toBeTruthy();
        expect(chain.confidence).toMatch(/certain|likely|possible/);
        expect(chain.evidence.length).toBeGreaterThan(0);
        for (const ev of chain.evidence) {
          expect(ev.eventId).toBeTruthy();
          expect(ev.eventType).toBeTruthy();
          expect(ev.timestamp).toBeTruthy();
          expect(ev.description.length).toBeGreaterThan(0);
        }
      }
    });

    it("supports lookback_days parameter", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 120);
      const oldTimestamp = oldDate.toISOString();

      insertEvent("STAGE_CHANGED", "deal", "deal-1", oldTimestamp, { stage_id: "stage-1" }, { stage_id: "stage-2" });

      const withinWindow = analyzeCausality({ entityType: "deal", entityId: "deal-1", lookbackDays: 90 });
      expect(withinWindow.chains).toEqual([]);

      const outsideWindow = analyzeCausality({ entityType: "deal", entityId: "deal-1", lookbackDays: 150 });
      expect(outsideWindow.chains.length).toBeGreaterThanOrEqual(1);
    });

    it("accepts a specific target_event_id", () => {
      const now = new Date().toISOString();
      const evt1 = insertEvent("STAGE_CHANGED", "deal", "deal-1", now, { stage_id: "stage-1" }, { stage_id: "stage-2" });
      insertEvent("STAGE_CHANGED", "deal", "deal-1", now, { stage_id: "stage-2" }, { stage_id: "stage-3" });

      const result = analyzeCausality({ entityType: "deal", entityId: "deal-1", targetEventId: evt1 });
      expect(result.chains.length).toBeGreaterThanOrEqual(1);
      expect(result.chains[0].targetEventId).toBe(evt1);
    });
  });
});

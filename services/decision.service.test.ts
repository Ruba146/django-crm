import { describe, it, expect, beforeEach } from "vitest";
import { evaluateDecisions, getAllDecisionRuleIds } from "@/services/decision.service";
import { initEventTables } from "@/scripts/init-event-tables";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

describe("decision.service", () => {
  beforeEach(() => {
    initEventTables();
    const db = getDb();
    db.prepare("DELETE FROM crm_events").run();
    db.prepare("DELETE FROM deals WHERE id LIKE 'deal-%'").run();
  });

  describe("getAllDecisionRuleIds", () => {
    it("returns all 10 rule ids", () => {
      const rules = getAllDecisionRuleIds();
      expect(rules).toHaveLength(10);
      expect(rules).toContain("follow_up_overdue");
      expect(rules).toContain("task_overdue");
      expect(rules).toContain("stage_stagnation");
      expect(rules).toContain("owner_overloaded");
      expect(rules).toContain("value_decline");
      expect(rules).toContain("probability_mismatch");
      expect(rules).toContain("inactive_customer");
      expect(rules).toContain("high_value_no_contact");
      expect(rules).toContain("missing_owner");
      expect(rules).toContain("contract_expiring");
    });
  });

  describe("evaluateDecisions", () => {
    it("returns empty results for a clean record with recent activity", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(`evt_clean_${Date.now()}`, "ENTITY_CREATED", "deal", "deal-clean", null, now, null, null, JSON.stringify({ expected_value_minor: 50000 }), null, "ui");

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-clean" });
      expect(result.results).toEqual([]);
      expect(result.summary).toEqual({ total: 0, critical: 0, warning: 0, info: 0 });
    });

    it("triggers follow_up_overdue when no recent activity", () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const oldTimestamp = oldDate.toISOString();

      db.prepare(
        `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(`evt_followup_${Date.now()}`, "DEAL_CREATED", "deal", "deal-followup", null, oldTimestamp, null, null, JSON.stringify({ expected_value_minor: 50000 }), null, "ui");

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-followup" });
      const rule = result.results.find((r) => r.ruleId === "follow_up_overdue");
      expect(rule).toBeDefined();
      expect(rule!.triggered).toBe(true);
      expect(rule!.severity).toBe("critical");
      expect(rule!.evidence.length).toBeGreaterThan(0);
    });

    it("triggers stage_stagnation when record stays in same stage too long", () => {
      const db = getDb();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const oldTimestamp = oldDate.toISOString();

      db.prepare(
        `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(`evt_stagnation_${Date.now()}`, "STAGE_CHANGED", "deal", "deal-stagnation", null, oldTimestamp, null, null, JSON.stringify({ stage_id: "stage-1", stage_label: "Proposal" }), null, "ui");

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-stagnation" });
      const rule = result.results.find((r) => r.ruleId === "stage_stagnation");
      expect(rule).toBeDefined();
      expect(rule!.triggered).toBe(true);
      expect(rule!.evidence.some((e) => e.type === "stage_info")).toBe(true);
    });

    it("triggers missing_owner when owner_id is null", () => {
      const db = getDb();
      db.prepare(`INSERT OR REPLACE INTO deals (id, name, lead_id, establishment_id, stage_id, owner_id, expected_value_minor, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`).run(
        "deal-no-owner",
        "Deal Without Owner",
        null,
        null,
        null,
        null,
        50000
      );

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-no-owner" });
      const rule = result.results.find((r) => r.ruleId === "missing_owner");
      expect(rule).toBeDefined();
      expect(rule!.triggered).toBe(true);
    });

    it("does not trigger value_decline for non-deal entities", () => {
      const result = evaluateDecisions({ entityType: "lead", entityId: "lead-1" });
      expect(result.results.find((r) => r.ruleId === "value_decline")).toBeUndefined();
    });

    it("does not trigger contract_expiring for non-deal entities", () => {
      const result = evaluateDecisions({ entityType: "lead", entityId: "lead-1" });
      expect(result.results.find((r) => r.ruleId === "contract_expiring")).toBeUndefined();
    });

    it("triggers probability_mismatch for high probability in early stage", () => {
      const db = getDb();
      db.prepare(
        `INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(`evt_prob_${Date.now()}`, "STAGE_CHANGED", "deal", "deal-prob", null, new Date().toISOString(), null, null, JSON.stringify({ stage_id: "stage-1", stage_label: "Lead", probability_pct: 90 }), null, "ui");

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-prob" });
      const rule = result.results.find((r) => r.ruleId === "probability_mismatch");
      expect(rule).toBeDefined();
      expect(rule!.triggered).toBe(true);
    });

    it("supports filtering rules via rules parameter", () => {
      const db = getDb();
      db.prepare(`INSERT OR REPLACE INTO deals (id, name, lead_id, establishment_id, stage_id, owner_id, expected_value_minor, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`).run(
        "deal-filter-owner",
        "Deal Filter Owner",
        null,
        null,
        null,
        null,
        50000
      );

      const result = evaluateDecisions({
        entityType: "deal",
        entityId: "deal-filter-owner",
        rules: ["missing_owner"],
      });
      expect(result.results.every((r) => r.ruleId === "missing_owner")).toBe(true);
    });

    it("returns summary with correct counts", () => {
      const db = getDb();
      db.prepare(`INSERT OR REPLACE INTO deals (id, name, lead_id, establishment_id, stage_id, owner_id, expected_value_minor, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`).run(
        "deal-summary",
        "Deal Summary",
        null,
        null,
        null,
        null,
        50000
      );

      const result = evaluateDecisions({ entityType: "deal", entityId: "deal-summary" });
      expect(result.summary.total).toBe(result.results.length);
      expect(result.summary.critical + result.summary.warning + result.summary.info).toBe(result.summary.total);
    });
  });
});

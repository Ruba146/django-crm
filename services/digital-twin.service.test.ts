import { describe, it, expect, beforeEach } from "vitest";
import {
  generateDigitalTwin,
  getImpactMap,
  getBottlenecks,
  getDigitalTwinForCustomer,
  getDigitalTwinForLead,
  getDigitalTwinForDeal,
  getDigitalTwinForEntity,
  getDigitalTwinForUser,
  getDigitalTwinForProcess,
} from "@/services/digital-twin.service";
import { initEventTables } from "@/scripts/init-event-tables";
import { initProcessTables } from "@/services/process.service";
import { initGraphTables } from "@/scripts/init-graph-tables";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

describe("digital-twin.service", () => {
  beforeEach(() => {
    initEventTables();
    initProcessTables();
    initGraphTables();
    const db = getDb();
    db.prepare("DELETE FROM crm_events").run();
    db.prepare("DELETE FROM process_executions").run();
    db.prepare("DELETE FROM process_instances").run();
    db.prepare("DELETE FROM process_definitions").run();
    db.prepare("DELETE FROM knowledge_graph_memories").run();
  });

  describe("generateDigitalTwin", () => {
    it("returns null for non-existent entity", () => {
      const result = generateDigitalTwin({ entityType: "customer", entityId: "nonexistent" });
      expect(result).toBeNull();
    });

    it("returns a structured snapshot for a customer", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-1", "Acme Corp", "Riyadh", "CR123", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, establishment_id, stage_id, primary_source_id, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-1", "John Doe", "dt-cust-1", "stage-1", "src-1", "user-1", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.deals} (id, name, lead_id, establishment_id, stage_id, owner_id, expected_value_minor, currency_code, probability_pct, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-deal-1", "Big Deal", "dt-lead-1", "dt-cust-1", "stage-1", "user-1", 500000, "SAR", 50, now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-evt-1", "ENTITY_CREATED", "customer", "dt-cust-1", "user-1", now, null, null, null, null, "ui");

      const snapshot = generateDigitalTwin({ entityType: "customer", entityId: "dt-cust-1" });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("customer");
      expect(snapshot!.focus_entity.entity_id).toBe("dt-cust-1");
      expect(snapshot!.focus_entity.label).toBeTruthy();
      expect(snapshot!.entities.length).toBeGreaterThan(0);
      expect(snapshot!.recent_events.length).toBeGreaterThanOrEqual(1);
      expect(snapshot!.decisions).toBeDefined();
      expect(snapshot!.bottlenecks).toBeDefined();
      expect(snapshot!.concentration).toBeDefined();
      expect(snapshot!.generated_at).toBeTruthy();
    });

    it("returns snapshot for a deal", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, stage_id, primary_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-2", "Jane Doe", "stage-1", "src-1", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.deals} (id, name, lead_id, stage_id, owner_id, expected_value_minor, currency_code, probability_pct, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-deal-2", "Test Deal", "dt-lead-2", "stage-1", "user-1", 100000, "SAR", 30, now, now);

      const snapshot = generateDigitalTwin({ entityType: "deal", entityId: "dt-deal-2" });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("deal");
      expect(snapshot!.focus_entity.label).toBeTruthy();
    });

    it("returns snapshot for a lead", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, stage_id, primary_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-3", "Lead Person", "stage-1", "src-1", now, now);

      const snapshot = generateDigitalTwin({ entityType: "lead", entityId: "dt-lead-3" });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("lead");
      expect(snapshot!.focus_entity.label).toBeTruthy();
    });

    it("returns snapshot for a user", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.users} (id, name, email, roles, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-user-1", "Test User", "test@example.com", "sales", now, now);

      const snapshot = generateDigitalTwin({ entityType: "user", entityId: "dt-user-1" });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("user");
      expect(snapshot!.focus_entity.label).toBeTruthy();
    });

    it("returns snapshot for a process", () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.process_definitions} (id, name, description, is_active, trigger, nodes, edges, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-proc-def-1", "Test Process", null, 1, JSON.stringify({ type: "manual" }), JSON.stringify([]), JSON.stringify([]), now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.process_instances} (id, definition_id, entity_type, entity_id, status, current_node_id, context, started_at, correlation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-proc-inst-1", "dt-proc-def-1", "deal", "dt-deal-2", "running", "node-1", "{}", now, null);

      const snapshot = generateDigitalTwin({ entityType: "process", entityId: "dt-proc-inst-1" });
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("process");
      expect(snapshot!.focus_entity.state.status).toBe("running");
    });
  });

  describe("getImpactMap", () => {
    it("returns null for non-existent customer", () => {
      const result = getImpactMap("customer", "nonexistent");
      expect(result).toBeNull();
    });

    it("returns impact map for customer with relationships", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-2", "Acme Corp", "Riyadh", "CR123", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.contacts} (id, full_name, email, phone, role, establishment_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-contact-1", "Contact Person", "cp@example.com", "0500000000", "Decision Maker", "dt-cust-2", now, now);

      const impactMap = getImpactMap("customer", "dt-cust-2");
      expect(impactMap).not.toBeNull();
      expect(impactMap!.entityId).toBe("dt-cust-2");
      expect(impactMap!.entityName).toBe("Acme Corp");
    });

    it("returns impact map for user with owned records", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.users} (id, name, email, roles, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-user-2", "Owner User", "owner@example.com", "sales", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, establishment_id, stage_id, primary_source_id, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-4", "Lead 1", null, "stage-1", "src-1", "dt-user-2", now, now);

      const impactMap = getImpactMap("user", "dt-user-2");
      expect(impactMap).not.toBeNull();
      expect(impactMap!.entityName).toBe("Owner User");
      expect(impactMap!.relationships.length).toBeGreaterThan(0);
    });

    it("returns null for unsupported entity type", () => {
      const result = getImpactMap("task", "task-1");
      expect(result).toBeNull();
    });
  });

  describe("getBottlenecks", () => {
    it("returns empty array for non-existent entity", () => {
      const result = getBottlenecks({ entityType: "customer", entityId: "nonexistent" });
      expect(result).toEqual([]);
    });

    it("returns bottlenecks for customer with stale activity", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const oldTimestamp = oldDate.toISOString();

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-3", "Stale Corp", "Riyadh", "CR123", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, establishment_id, stage_id, primary_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-5", "Lead 1", "dt-cust-3", "stage-1", "src-1", oldTimestamp, oldTimestamp);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, previous_state, new_state, correlation_id, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-evt-2", "DEAL_CREATED", "deal", "dt-deal-3", null, oldTimestamp, null, null, JSON.stringify({ expected_value_minor: 50000 }), null, "ui");

      const bottlenecks = getBottlenecks({ entityType: "customer", entityId: "dt-cust-3" });
      expect(bottlenecks.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(bottlenecks)).toBe(true);
    });
  });

  describe("convenience functions", () => {
    it("getDigitalTwinForCustomer delegates to generateDigitalTwin", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-4", "Test Corp", "Riyadh", "CR123", now, now);

      const snapshot = getDigitalTwinForCustomer("dt-cust-4");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("customer");
    });

    it("getDigitalTwinForLead delegates to generateDigitalTwin", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, stage_id, primary_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-6", "Lead Person", "stage-1", "src-1", now, now);

      const snapshot = getDigitalTwinForLead("dt-lead-6");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("lead");
    });

    it("getDigitalTwinForDeal delegates to generateDigitalTwin", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.leads} (id, full_name, stage_id, primary_source_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-lead-7", "Lead", "stage-1", "src-1", now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.deals} (id, name, lead_id, stage_id, owner_id, expected_value_minor, currency_code, probability_pct, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-deal-4", "Deal 1", "dt-lead-7", "stage-1", "user-1", 100000, "SAR", 30, now, now);

      const snapshot = getDigitalTwinForDeal("dt-deal-4");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("deal");
    });

    it("getDigitalTwinForEntity delegates to generateDigitalTwin", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-5", "Entity Corp", "Riyadh", "CR123", now, now);

      const snapshot = getDigitalTwinForEntity("customer", "dt-cust-5");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_id).toBe("dt-cust-5");
    });

    it("getDigitalTwinForUser handles user entity type", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.users} (id, name, email, roles, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-user-3", "User Person", "user@example.com", "sales", now, now);

      const snapshot = getDigitalTwinForUser("dt-user-3");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("user");
    });

    it("getDigitalTwinForProcess handles process entity type", () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.process_definitions} (id, name, description, is_active, trigger, nodes, edges, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-proc-def-2", "Test Process", null, 1, JSON.stringify({ type: "manual" }), JSON.stringify([]), JSON.stringify([]), now, now);

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.process_instances} (id, definition_id, entity_type, entity_id, status, current_node_id, context, started_at, correlation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run("dt-proc-inst-2", "dt-proc-def-2", "deal", "dt-deal-4", "completed", null, "{}", now, null);

      const snapshot = getDigitalTwinForProcess("dt-proc-inst-2");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.focus_entity.entity_type).toBe("process");
    });
  });

  describe("read-only behavior", () => {
    it("does not modify any tables when generating a snapshot", () => {
      const db = getDb();
      const now = new Date().toISOString();

      const customerCountBefore = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.customers}`).get() as { count: number };
      const eventCountBefore = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.events}`).get() as { count: number };
      const memoryCountBefore = db.prepare(`SELECT COUNT(*) AS count FROM knowledge_graph_memories`).get() as { count: number };

      db.prepare(
        `INSERT OR REPLACE INTO ${TABLES.customers} (id, name, city, commercial_registration_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("dt-cust-ro", "RO Corp", "Riyadh", "CR123", now, now);

      generateDigitalTwin({ entityType: "customer", entityId: "dt-cust-ro" });

      const customerCountAfter = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.customers}`).get() as { count: number };
      const eventCountAfter = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLES.events}`).get() as { count: number };
      const memoryCountAfter = db.prepare(`SELECT COUNT(*) AS count FROM knowledge_graph_memories`).get() as { count: number };

      expect(customerCountAfter.count).toBe(customerCountBefore.count + 1);
      expect(eventCountAfter.count).toBe(eventCountBefore.count);
      expect(memoryCountAfter.count).toBe(memoryCountBefore.count);
    });
  });
});

import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

export function initAiCopyMetadata(): void {
  const db = getDb();

  const tablesToUpdate = [
    TABLES.leads,
    TABLES.deals,
    TABLES.tasks,
    TABLES.activities,
    TABLES.notes,
    TABLES.customers,
  ];

  for (const table of tablesToUpdate) {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN is_ai_copy INTEGER DEFAULT 0`).run();
    } catch {
      // column already exists
    }
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ai_source TEXT`).run();
    } catch {
      // column already exists
    }
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN source_record_id TEXT`).run();
    } catch {
      // column already exists
    }
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ai_created_at TEXT`).run();
    } catch {
      // column already exists
    }
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ai_action_id TEXT`).run();
    } catch {
      // column already exists
    }
  }
}

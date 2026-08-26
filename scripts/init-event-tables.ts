import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

export function initEventTables(): void {
  const db = getDb();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${TABLES.events} (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT,
      previous_state TEXT,
      new_state TEXT,
      correlation_id TEXT,
      source TEXT
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crm_events_entity
    ON ${TABLES.events} (entity_type, entity_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crm_events_timestamp
    ON ${TABLES.events} (timestamp)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crm_events_type
    ON ${TABLES.events} (event_type)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crm_events_correlation
    ON ${TABLES.events} (correlation_id)
  `).run();
}

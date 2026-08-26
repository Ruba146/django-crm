import { getDb } from "@/lib/db";

export function initGraphTables(): void {
  const db = getDb();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS knowledge_graph_memories (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      source TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_kg_memories_entity
    ON knowledge_graph_memories (entity_type, entity_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_kg_memories_type
    ON knowledge_graph_memories (memory_type)
  `).run();
}

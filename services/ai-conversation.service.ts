import { getDb } from "@/lib/db";
import { normalizeArabic } from "@/services/ai-context.service";

export interface AIConversation {
  id: string;
  title: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  is_streaming: number;
  attachments: string | null;
  suggested_actions: string | null;
  created_at: string;
}

export interface ConversationWithMessages extends AIConversation {
  messages: AIMessage[];
}

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function ensureTables(db: ReturnType<typeof getDb>): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      entity_type TEXT,
      entity_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      is_streaming INTEGER NOT NULL DEFAULT 0,
      attachments TEXT,
      suggested_actions TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages(conversation_id, timestamp)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated
    ON ai_conversations(updated_at DESC)
  `).run();
}

export function initAiTables(): void {
  const db = getDb();
  ensureTables(db);
}

export function listConversations(limit = 50): AIConversation[] {
  const db = getDb();
  ensureTables(db);
  return db
    .prepare(
      `SELECT id, title, entity_type, entity_id, created_at, updated_at
        FROM ai_conversations
        ORDER BY updated_at DESC
        LIMIT ?`
    )
    .all(limit) as AIConversation[];
}

export function getConversation(id: string): ConversationWithMessages | null {
  const db = getDb();
  ensureTables(db);
  const conversation = db.prepare(
    `SELECT id, title, entity_type, entity_id, created_at, updated_at
      FROM ai_conversations
      WHERE id = ? LIMIT 1`
  ).get(id) as AIConversation | undefined;

  if (!conversation) return null;

  const messages = db
    .prepare(
      `SELECT id, conversation_id, role, content, timestamp, is_streaming, attachments, suggested_actions, created_at
        FROM ai_messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC`
    )
    .all(id) as AIMessage[];

  return { ...conversation, messages };
}

export function createConversation(
  title = "New Conversation",
  entityType: string | null = null,
  entityId: string | null = null
): AIConversation {
  const db = getDb();
  ensureTables(db);
  const id = generateId();
  const created = now();
  db.prepare(
    `INSERT INTO ai_conversations (id, title, entity_type, entity_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, title, entityType, entityId, created, created);
  return { id, title, entity_type: entityType, entity_id: entityId, created_at: created, updated_at: created };
}

export function updateConversationTitle(id: string, title: string): boolean {
  const db = getDb();
  ensureTables(db);
  const result = db.prepare(
    `UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?`
  ).run(title, now(), id);
  return result.changes > 0;
}

export function touchConversation(id: string): boolean {
  const db = getDb();
  ensureTables(db);
  const result = db.prepare(
    `UPDATE ai_conversations SET updated_at = ? WHERE id = ?`
  ).run(now(), id);
  return result.changes > 0;
}

export function deleteConversation(id: string): boolean {
  const db = getDb();
  ensureTables(db);
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM ai_messages WHERE conversation_id = ?`).run(id);
    const result = db.prepare(`DELETE FROM ai_conversations WHERE id = ?`).run(id);
    return result.changes > 0;
  });
  return tx();
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  isStreaming = false
): AIMessage {
  const db = getDb();
  ensureTables(db);
  const id = generateId();
  const timestamp = Date.now();
  const created = now();
  db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, timestamp, is_streaming, attachments, suggested_actions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
  ).run(id, conversationId, role, content, timestamp, isStreaming ? 1 : 0, created);
  touchConversation(conversationId);
  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    timestamp,
    is_streaming: isStreaming ? 1 : 0,
    attachments: null,
    suggested_actions: null,
    created_at: created,
  };
}

export function updateMessageContent(id: string, content: string): boolean {
  const db = getDb();
  ensureTables(db);
  const msg = db.prepare(
    `SELECT conversation_id FROM ai_messages WHERE id = ? LIMIT 1`
  ).get(id) as { conversation_id: string } | undefined;
  if (!msg) return false;
  const result = db.prepare(
    `UPDATE ai_messages SET content = ? WHERE id = ?`
  ).run(content, id);
  if (result.changes > 0) {
    touchConversation(msg.conversation_id);
  }
  return result.changes > 0;
}

export function markMessageStreamingDone(id: string): boolean {
  const db = getDb();
  ensureTables(db);
  const msg = db.prepare(
    `SELECT conversation_id FROM ai_messages WHERE id = ? LIMIT 1`
  ).get(id) as { conversation_id: string } | undefined;
  if (!msg) return false;
  const result = db.prepare(
    `UPDATE ai_messages SET is_streaming = 0 WHERE id = ?`
  ).run(id);
  if (result.changes > 0) {
    touchConversation(msg.conversation_id);
  }
  return result.changes > 0;
}

export function searchConversations(query: string, limit = 20): Array<{ conversation: AIConversation; messages: AIMessage[] }> {
  const db = getDb();
  ensureTables(db);
  const normalizedQuery = normalizeArabic(query.toLowerCase().trim());

  const allConversations = db
    .prepare(
      `SELECT id, title, entity_type, entity_id, created_at, updated_at
        FROM ai_conversations
        ORDER BY updated_at DESC`
    )
    .all() as AIConversation[];

  const matchedConversations = allConversations.filter((c) => {
    const normalizedTitle = normalizeArabic(c.title.toLowerCase());
    return normalizedTitle.includes(normalizedQuery);
  }).slice(0, limit);

  const results: Array<{ conversation: AIConversation; messages: AIMessage[] }> = [];
  for (const conv of matchedConversations) {
    const allMessages = db
      .prepare(
        `SELECT id, conversation_id, role, content, timestamp, is_streaming, attachments, suggested_actions, created_at
          FROM ai_messages
          WHERE conversation_id = ?
          ORDER BY timestamp ASC`
      )
      .all(conv.id) as AIMessage[];
    const matchedMessages = allMessages.filter((m) =>
      normalizeArabic(m.content.toLowerCase()).includes(normalizedQuery)
    );
    results.push({ conversation: conv, messages: matchedMessages });
  }

  if (results.length === 0 && normalizedQuery.length >= 3) {
    const matchingMessages = db
      .prepare(
        `SELECT m.conversation_id, m.content, m.timestamp, c.id, c.title, c.entity_type, c.entity_id, c.created_at, c.updated_at
          FROM ai_messages m
          JOIN ai_conversations c ON c.id = m.conversation_id
          ORDER BY m.timestamp DESC
          LIMIT ?`
      )
      .all(limit) as Array<{
        conversation_id: string;
        content: string;
        timestamp: number;
        id: string;
        title: string;
        entity_type: string | null;
        entity_id: string | null;
        created_at: string;
        updated_at: string;
      }>;

    const seen = new Set<string>();
    for (const row of matchingMessages) {
      if (seen.has(row.conversation_id)) continue;
      if (!normalizeArabic(row.content.toLowerCase()).includes(normalizedQuery)) continue;
      seen.add(row.conversation_id);
      const messages = db
        .prepare(
          `SELECT id, conversation_id, role, content, timestamp, is_streaming, attachments, suggested_actions, created_at
            FROM ai_messages
            WHERE conversation_id = ?
            ORDER BY timestamp ASC`
        )
        .all(row.conversation_id) as AIMessage[];
      results.push({
        conversation: {
          id: row.id,
          title: row.title,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        messages,
      });
    }
  }

  return results.slice(0, limit);
}

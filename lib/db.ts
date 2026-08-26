import Database from "better-sqlite3";
import path from "node:path";

/**
 * Global singleton connection to the existing SQLite CRM database.
 *
 * The database is created by the project and shared across features.
 * better-sqlite3 is synchronous, so a single shared connection is safe
 * and performant for both server components and route handlers.
 *
 * NOTE: This module must only be imported from server-side code
 * (services, route handlers, server components). It uses Node's `path`
 * module and is not compatible with the browser.
 */

declare global {
  var __crmDb: Database.Database | undefined;
}

const DB_PATH = process.env.DATABASE_PATH ?? "database/crm.db";

function createDatabase(): Database.Database {
  const resolved = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    DB_PATH
  );
  const db = new Database(resolved);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__crmDb) {
    globalThis.__crmDb = createDatabase();
  }
  return globalThis.__crmDb;
}

export default getDb;

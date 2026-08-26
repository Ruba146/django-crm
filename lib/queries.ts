import { getDb } from "@/lib/db";

/**
 * Shared raw query helpers used by the service layer.
 *
 * All SQL lives behind these helpers so individual services stay
 * declarative. Services never touch React — they only read the DB.
 */

/** Count rows in a table, optionally filtered by a WHERE clause. Uses DISTINCT id to avoid inflated counts from duplicate IDs. */
export function countRows(
  table: string,
  where = "",
  params: unknown[] = []
): number {
  const db = getDb();
  const sql = `SELECT COUNT(DISTINCT id) AS count FROM ${table}${where ? ` WHERE ${where}` : ""}`;
  const row = db.prepare(sql).get(...params) as { count: number };
  return Number(row?.count ?? 0);
}

/** Fetch all rows from a table with an optional WHERE clause. */
export function selectAll<T>(
  table: string,
  where = "",
  params: unknown[] = [],
  orderBy = ""
): T[] {
  const db = getDb();
  const sql = `SELECT * FROM ${table}${where ? ` WHERE ${where}` : ""}${orderBy ? ` ORDER BY ${orderBy}` : ""}`;
  return db.prepare(sql).all(...params) as T[];
}

/** Fetch a single row by id. */
export function selectById<T>(table: string, id: string): T | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).get(id) as
    | T
    | undefined;
}

/** Paginated select. */
export function selectPaginated<T>(
  table: string,
  page: number,
  pageSize: number,
  where = "",
  params: unknown[] = [],
  orderBy = ""
): { data: T[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const total = countRows(table, where, params);
  const data = db
    .prepare(
      `SELECT * FROM ${table}${where ? ` WHERE ${where}` : ""}${orderBy ? ` ORDER BY ${orderBy}` : ""} LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as T[];
  return { data, total };
}

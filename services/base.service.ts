import { getDb } from "@/lib/db";

/**
 * Base service helpers.
 *
 * better-sqlite3 is synchronous, so these functions return values
 * directly and can be awaited inside server components if needed.
 * Every domain service extends this base to keep queries consistent
 * and to guarantee that DB access never leaks into React components.
 */

export abstract class BaseService<T> {
  protected abstract readonly table: string;

  /** Count all rows. Uses DISTINCT id to avoid inflated counts from duplicate IDs. */
  count(where = "", params: unknown[] = []): number {
    const db = getDb();
    const sql = `SELECT COUNT(DISTINCT id) AS count FROM ${this.table}${where ? ` WHERE ${where}` : ""}`;
    const row = db.prepare(sql).get(...params) as { count: number };
    return Number(row?.count ?? 0);
  }

  /** Fetch a single row by id. */
  findById(id: string): T | undefined {
    const db = getDb();
    return db
      .prepare(`SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`)
      .get(id) as T | undefined;
  }

  /** Fetch all rows (optionally filtered / ordered). */
  findAll(where = "", params: unknown[] = [], orderBy = ""): T[] {
    const db = getDb();
    const sql = `SELECT * FROM ${this.table}${where ? ` WHERE ${where}` : ""}${orderBy ? ` ORDER BY ${orderBy}` : ""}`;
    return db.prepare(sql).all(...params) as T[];
  }

  /** Fetch a page of rows. */
  findPage(
    page: number,
    pageSize: number,
    where = "",
    params: unknown[] = [],
    orderBy = ""
  ): { data: T[]; total: number; page: number; pageSize: number; totalPages: number } {
    const db = getDb();
    const offset = (page - 1) * pageSize;
    const total = this.count(where, params);
    const data = db
      .prepare(
        `SELECT * FROM ${this.table}${where ? ` WHERE ${where}` : ""}${orderBy ? ` ORDER BY ${orderBy}` : ""} LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset) as T[];
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}

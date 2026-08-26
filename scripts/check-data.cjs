const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// Check if duplicate IDs are only test data or widespread
const tables = ["deals", "leads", "establishments", "users"];
for (const t of tables) {
  const rows = db.prepare(`SELECT id, COUNT(*) as cnt FROM ${t} GROUP BY id HAVING COUNT(*) > 1`).all();
  console.log(t + " duplicates:", rows.length);
  if (rows.length > 0) {
    console.log("  First 5:", rows.slice(0, 5).map(r => r.id));
  }
}

// Check the total unique IDs vs total rows for deals
const sql1 = `SELECT COUNT(*) as total, COUNT(DISTINCT id) as unique_ids FROM deals WHERE deleted_at IS NULL`;
const r1 = db.prepare(sql1).get();
console.log("Deals: total=" + r1.total + ", unique_ids=" + r1.unique_ids);

// Check how many deals have real UUIDs vs test prefixes
const sql2 = `SELECT id FROM deals WHERE deleted_at IS NULL LIMIT 20`;
const r2 = db.prepare(sql2).all();
console.log("Sample deal IDs:", r2.map(r => r.id));

// Check the fixed-graph endpoint counts
const sql3 = `SELECT COUNT(DISTINCT l.id) as cnt FROM leads l WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL`;
const r3 = db.prepare(sql3).get();
console.log("Distinct active leads:", r3.cnt);

const sql4 = `SELECT COUNT(DISTINCT d.id) as cnt FROM deals d WHERE d.deleted_at IS NULL`;
const r4 = db.prepare(sql4).get();
console.log("Distinct active deals:", r4.cnt);

const sql5 = `SELECT COUNT(DISTINCT e.id) as cnt FROM establishments e WHERE e.deleted_at IS NULL`;
const r5 = db.prepare(sql5).get();
console.log("Distinct active customers:", r5.cnt);

const sql6 = `SELECT COUNT(DISTINCT t.id) as cnt FROM tasks t`;
const r6 = db.prepare(sql6).get();
console.log("Distinct tasks:", r6.cnt);

db.close();

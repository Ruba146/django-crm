const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// Check for duplicate IDs in each table
const tables = {
  deals: "id",
  establishments: "id",
  leads: "id",
  pipeline_stages: "id",
  users: "id",
};

for (const [table, col] of Object.entries(tables)) {
  const row = db
    .prepare(`SELECT ${col}, COUNT(*) as cnt FROM ${table} GROUP BY ${col} HAVING COUNT(*) > 1 LIMIT 5`)
    .all();
  if (row.length > 0) {
    console.log(`DUPLICATES in ${table}:`, row);
  } else {
    console.log(`No duplicates in ${table}`);
  }
}

// Check the specific join multiplication
const sql = `
  SELECT d.id, COUNT(*) as cnt
  FROM deals d
  LEFT JOIN establishments e ON e.id = d.establishment_id
  LEFT JOIN leads l ON l.id = d.lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
  LEFT JOIN users u ON u.id = d.owner_id
  WHERE d.deleted_at IS NULL
  GROUP BY d.id
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 10
`;
const dupes = db.prepare(sql).all();
console.log("Deals with multiplied rows:", dupes.length);
if (dupes.length > 0) {
  console.log("First few:", dupes.slice(0, 5));
}

// Find which join causes multiplication
const checks = [
  { name: "establishments", sql: `SELECT d.id, COUNT(*) as cnt FROM deals d LEFT JOIN establishments e ON e.id = d.establishment_id WHERE d.deleted_at IS NULL GROUP BY d.id HAVING cnt > 1 LIMIT 5` },
  { name: "leads", sql: `SELECT d.id, COUNT(*) as cnt FROM deals d LEFT JOIN leads l ON l.id = d.lead_id WHERE d.deleted_at IS NULL GROUP BY d.id HAVING cnt > 1 LIMIT 5` },
  { name: "pipeline_stages", sql: `SELECT d.id, COUNT(*) as cnt FROM deals d LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id WHERE d.deleted_at IS NULL GROUP BY d.id HAVING cnt > 1 LIMIT 5` },
  { name: "users", sql: `SELECT d.id, COUNT(*) as cnt FROM deals d LEFT JOIN users u ON u.id = d.owner_id WHERE d.deleted_at IS NULL GROUP BY d.id HAVING cnt > 1 LIMIT 5` },
];

for (const c of checks) {
  const rows = db.prepare(c.sql).all();
  console.log(c.name + " join causes multiplication:", rows.length > 0 ? "YES (" + rows.length + " deals)" : "no");
}

db.close();

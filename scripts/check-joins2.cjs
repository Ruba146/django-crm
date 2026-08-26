const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// How many total rows does the join produce?
const sql = `
  SELECT COUNT(*) as cnt
  FROM deals d
  LEFT JOIN establishments e ON e.id = d.establishment_id
  LEFT JOIN leads l ON l.id = d.lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
  LEFT JOIN users u ON u.id = d.owner_id
  WHERE d.deleted_at IS NULL
`;
const row = db.prepare(sql).get();
console.log("Total joined rows:", row.cnt);

// How many unique deal IDs are there in deals table?
const sql2 = `SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`;
const row2 = db.prepare(sql2).get();
console.log("Unique deal IDs in deals table:", row2.cnt);

// Which deals are in the first 200 rows?
const sql3 = `
  SELECT d.id, d.created_at, COUNT(*) as cnt
  FROM deals d
  LEFT JOIN establishments e ON e.id = d.establishment_id
  LEFT JOIN leads l ON l.id = d.lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
  LEFT JOIN users u ON u.id = d.owner_id
  WHERE d.deleted_at IS NULL
  GROUP BY d.id
  ORDER BY MAX(d.created_at) DESC
  LIMIT 200
`;
const rows3 = db.prepare(sql3).all();
console.log("First 200 grouped by deal ID:", rows3.length, "unique deals");
console.log("First 5:", rows3.slice(0, 5));

// Check if there are many test/debug deals
const sql4 = `SELECT id, name, created_at FROM deals WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`;
const rows4 = db.prepare(sql4).all();
console.log("First 20 deals by created_at:");
rows4.forEach(r => console.log("  ", r.id, "|", r.name));

db.close();

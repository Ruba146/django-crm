const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

const sql = `
  SELECT
    d.id,
    d.name,
    e.name AS company,
    l.full_name AS lead_name,
    d.owner_id,
    u.name AS owner_name,
    d.stage_id,
    ps.label AS stage_label,
    ps.color AS stage_color,
    ps.terminal_type,
    d.expected_value_minor,
    d.currency_code,
    d.probability_pct,
    d.target_close_date,
    d.created_at,
    d.is_ai_copy
  FROM deals d
  LEFT JOIN establishments e ON e.id = d.establishment_id
  LEFT JOIN leads l ON l.id = d.lead_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
  LEFT JOIN users u ON u.id = d.owner_id
  WHERE d.deleted_at IS NULL
  ORDER BY d.created_at DESC
  LIMIT 200
`;

const rows = db.prepare(sql).all();
console.log("getDeals(200) returns:", rows.length, "rows");

const uniqueRows = Array.from(new Map(rows.map((r) => [r.id, r])).values());
console.log("After dedup:", uniqueRows.length, "rows");

const sql2 = `SELECT COUNT(*) as cnt FROM deals WHERE deleted_at IS NULL`;
const cnt = db.prepare(sql2).get();
console.log("Total active deals:", cnt.cnt);

const sql3 = `SELECT COUNT(*) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`;
const cnt3 = db.prepare(sql3).get();
console.log("Total active leads:", cnt3.cnt);

const sql4 = `SELECT COUNT(*) as cnt FROM establishments WHERE deleted_at IS NULL`;
const cnt4 = db.prepare(sql4).get();
console.log("Total active customers:", cnt4.cnt);

const sql5 = `SELECT COUNT(*) as cnt FROM tasks`;
const cnt5 = db.prepare(sql5).get();
console.log("Total tasks:", cnt5.cnt);

db.close();

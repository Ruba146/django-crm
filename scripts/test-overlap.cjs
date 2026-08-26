const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

const pageSize = 25;

// Verify no overlap between deal pages
const dealsSql = `
  WITH deduped_deals AS (
    SELECT id, MAX(name) AS name, MAX(establishment_id) AS establishment_id, MAX(lead_id) AS lead_id,
           MAX(owner_id) AS owner_id, MAX(stage_id) AS stage_id,
           MAX(expected_value_minor) AS expected_value_minor, MAX(currency_code) AS currency_code,
           MAX(probability_pct) AS probability_pct, MAX(target_close_date) AS target_close_date,
           MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy
    FROM deals
    WHERE deleted_at IS NULL
    GROUP BY id
  )
  SELECT dd.id, dd.created_at
  FROM deduped_deals dd
  ORDER BY dd.created_at DESC, dd.id ASC
  LIMIT ? OFFSET ?
`;

const allPageIds = [];
for (let p = 0; p < 10; p++) {
  const offset = p * pageSize;
  const rows = db.prepare(dealsSql).all(pageSize, offset);
  if (rows.length === 0) break;
  const ids = rows.map(r => r.id);
  allPageIds.push(...ids);
}

const uniqueIds = new Set(allPageIds);
console.log("Total deal IDs across pages:", allPageIds.length);
console.log("Unique deal IDs:", uniqueIds.size);
console.log("Overlap:", allPageIds.length - uniqueIds.size);

// Verify count matches
const countRow = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`).get();
console.log("DB distinct count:", countRow.cnt);
console.log("Match:", uniqueIds.size === countRow.cnt);

// Same for leads
const leadsSql = `
  WITH deduped_leads AS (
    SELECT id, MAX(full_name) AS full_name, MAX(created_at) AS created_at
    FROM leads
    WHERE deleted_at IS NULL AND merged_into_id IS NULL
    GROUP BY id
  )
  SELECT dl.id, dl.created_at
  FROM deduped_leads dl
  ORDER BY dl.created_at DESC, dl.id ASC
  LIMIT ? OFFSET ?
`;

const allLeadIds = [];
for (let p = 0; p < 50; p++) {
  const offset = p * pageSize;
  const rows = db.prepare(leadsSql).all(pageSize, offset);
  if (rows.length === 0) break;
  const ids = rows.map(r => r.id);
  allLeadIds.push(...ids);
}

const uniqueLeadIds = new Set(allLeadIds);
console.log("\nTotal lead IDs across pages:", allLeadIds.length);
console.log("Unique lead IDs:", uniqueLeadIds.size);
console.log("Overlap:", allLeadIds.length - uniqueLeadIds.size);

const leadsCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`).get();
console.log("DB distinct count:", leadsCount.cnt);
console.log("Match:", uniqueLeadIds.size === leadsCount.cnt);

db.close();

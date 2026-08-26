const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// Test the graph service's count queries
const leadsCount = db.prepare(`
  SELECT COUNT(DISTINCT l.id) as cnt FROM leads l 
  LEFT JOIN establishments e ON e.id = l.establishment_id 
  WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
`).get();
console.log("Graph leads count (with LEFT JOIN):", leadsCount.cnt);

const leadsCountNoJoin = db.prepare(`
  SELECT COUNT(DISTINCT id) as cnt FROM leads 
  WHERE deleted_at IS NULL AND merged_into_id IS NULL
`).get();
console.log("Graph leads count (no JOIN):", leadsCountNoJoin.cnt);

const dealsCount = db.prepare(`
  SELECT COUNT(DISTINCT d.id) as cnt FROM deals d 
  LEFT JOIN establishments ec ON ec.id = d.establishment_id 
  LEFT JOIN leads l ON l.id = d.lead_id 
  WHERE d.deleted_at IS NULL
`).get();
console.log("Graph deals count (with LEFT JOINs):", dealsCount.cnt);

const dealsCountNoJoin = db.prepare(`
  SELECT COUNT(DISTINCT id) as cnt FROM deals 
  WHERE deleted_at IS NULL
`).get();
console.log("Graph deals count (no JOIN):", dealsCountNoJoin.cnt);

// Verify the CTE-based queries match
const dealsCte = db.prepare(`
  WITH deduped_deals AS (
    SELECT id FROM deals WHERE deleted_at IS NULL GROUP BY id
  )
  SELECT COUNT(*) as cnt FROM deduped_deals
`).get();
console.log("Deals CTE count:", dealsCte.cnt);

const leadsCte = db.prepare(`
  WITH deduped_leads AS (
    SELECT id FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL GROUP BY id
  )
  SELECT COUNT(*) as cnt FROM deduped_leads
`).get();
console.log("Leads CTE count:", leadsCte.cnt);

db.close();

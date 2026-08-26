const Database = require('better-sqlite3');
const db = new Database('database/crm.db');

console.log('=== ALL ESTABLISHMENT NAMES (sample) ===');
const estNames = db.prepare(`
  SELECT e.name, e.industry_id, i.label as industry_label
  FROM establishments e
  LEFT JOIN industries i ON i.id = e.industry_id
  WHERE e.deleted_at IS NULL
  ORDER BY e.name
`).all();
console.log(JSON.stringify(estNames, null, 2));

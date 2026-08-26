const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

console.log("=== ACTUAL DB COUNTS (DISTINCT IDs) ===");
const counts = {
  deals: db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`).get().cnt,
  leads: db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`).get().cnt,
  customers: db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM establishments WHERE deleted_at IS NULL`).get().cnt,
  tasks: db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM tasks`).get().cnt,
};
console.log("Deals:", counts.deals);
console.log("Leads:", counts.leads);
console.log("Customers:", counts.customers);
console.log("Tasks:", counts.tasks);

console.log("\n=== GRAPH SERVICE COUNTS (getGraphRecordsList) ===");
// Simulate what getGraphRecordsList returns for page 1
const leadsCount = db.prepare(`
  SELECT COUNT(DISTINCT l.id) as cnt FROM leads l 
  LEFT JOIN establishments e ON e.id = l.establishment_id 
  WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
`).get().cnt;
const dealsCount = db.prepare(`
  SELECT COUNT(DISTINCT d.id) as cnt FROM deals d 
  LEFT JOIN establishments ec ON ec.id = d.establishment_id 
  LEFT JOIN leads l ON l.id = d.lead_id 
  WHERE d.deleted_at IS NULL
`).get().cnt;
console.log("Graph leads total:", leadsCount);
console.log("Graph deals total:", dealsCount);
console.log("Match:", leadsCount === counts.leads && dealsCount === counts.deals);

console.log("\n=== DASHBOARD STATS (countRows) ===");
const { countRows } = require('./lib/queries.ts');
// Can't import TS directly, so let's just run the SQL
const dashDeals = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`).get().cnt;
const dashLeads = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`).get().cnt;
const dashCustomers = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM establishments WHERE deleted_at IS NULL`).get().cnt;
const dashTasks = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM tasks`).get().cnt;
console.log("Dashboard deals:", dashDeals);
console.log("Dashboard leads:", dashLeads);
console.log("Dashboard customers:", dashCustomers);
console.log("Dashboard tasks:", dashTasks);

db.close();

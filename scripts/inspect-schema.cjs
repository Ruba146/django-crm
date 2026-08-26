const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

const tables = ["establishments", "leads", "deals", "pipeline_stages", "sources", "industries", "tasks", "activities", "users", "contacts", "notes", "crm_events", "knowledge_graph_memories"];

for (const t of tables) {
  console.log("--- " + t + " ---");
  const cols = db.prepare("PRAGMA table_info(" + t + ")").all();
  for (const c of cols) {
    console.log("  " + c.name + " (" + c.type + ")");
  }
}

// Check some actual data
console.log("\n--- Sample leads ---");
const leads = db.prepare("SELECT id, full_name, establishment_id, stage_id, primary_source_id FROM leads WHERE deleted_at IS NULL LIMIT 5").all();
for (const l of leads) console.log(l);

console.log("\n--- Sample establishments ---");
const ests = db.prepare("SELECT id, name, industry_id FROM establishments WHERE deleted_at IS NULL LIMIT 5").all();
for (const e of ests) console.log(e);

console.log("\n--- Pipeline stages ---");
const stages = db.prepare("SELECT id, label, color FROM pipeline_stages").all();
for (const s of stages) console.log(s);

console.log("\n--- Sources ---");
const sources = db.prepare("SELECT id, label, color FROM sources").all();
for (const s of sources) console.log(s);

db.close();

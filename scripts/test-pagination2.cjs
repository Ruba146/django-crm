const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// Test deal pagination with CTE
const pageSize = 25;

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
  SELECT
    dd.id, dd.name, dd.created_at
  FROM deduped_deals dd
  ORDER BY dd.created_at DESC, dd.id ASC
  LIMIT ? OFFSET ?
`;

for (let p = 1; p <= 5; p++) {
  const offset = (p - 1) * pageSize;
  const rows = db.prepare(dealsSql).all(pageSize, offset);
  const ids = rows.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log(`Deals page ${p}: ${rows.length} rows, ${uniqueIds.size} unique IDs`);
  if (uniqueIds.size !== rows.length) {
    console.log("  WARNING: Duplicate IDs in page!");
  }
}

const countRow = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`).get();
console.log("\nTotal distinct deals:", countRow.cnt);

// Test leads pagination with CTE
const leadsSql = `
  WITH deduped_leads AS (
    SELECT id, MAX(full_name) AS full_name, MAX(normalized_phone) AS normalized_phone,
           MAX(normalized_email) AS normalized_email, MAX(establishment_id) AS establishment_id,
           MAX(primary_source_id) AS primary_source_id, MAX(stage_id) AS stage_id,
           MAX(owner_id) AS owner_id, MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy
    FROM leads
    WHERE deleted_at IS NULL AND merged_into_id IS NULL
    GROUP BY id
  )
  SELECT
    dl.id, dl.full_name, dl.created_at
  FROM deduped_leads dl
  ORDER BY dl.created_at DESC, dl.id ASC
  LIMIT ? OFFSET ?
`;

for (let p = 1; p <= 3; p++) {
  const offset = (p - 1) * pageSize;
  const rows = db.prepare(leadsSql).all(pageSize, offset);
  const ids = rows.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log(`Leads page ${p}: ${rows.length} rows, ${uniqueIds.size} unique IDs`);
}

const leadsCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`).get();
console.log("Total distinct leads:", leadsCount.cnt);

// Test customers pagination with CTE
const custSql = `
  WITH deduped_customers AS (
    SELECT id, MAX(name) AS name, MAX(city) AS city,
           MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy
    FROM establishments
    WHERE deleted_at IS NULL
    GROUP BY id
  )
  SELECT dc.id, dc.name, dc.created_at
  FROM deduped_customers dc
  ORDER BY dc.created_at DESC, dc.id ASC
  LIMIT ? OFFSET ?
`;

for (let p = 1; p <= 3; p++) {
  const offset = (p - 1) * pageSize;
  const rows = db.prepare(custSql).all(pageSize, offset);
  const ids = rows.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log(`Customers page ${p}: ${rows.length} rows, ${uniqueIds.size} unique IDs`);
}

const custCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM establishments WHERE deleted_at IS NULL`).get();
console.log("Total distinct customers:", custCount.cnt);

// Test tasks pagination with CTE
const tasksSql = `
  WITH deduped_tasks AS (
    SELECT id, MAX(title) AS title, MAX(description) AS description,
           MAX(entity_type) AS entity_type, MAX(entity_id) AS entity_id,
           MAX(assignee_id) AS assignee_id, MAX(task_type_id) AS task_type_id,
           MAX(mode) AS mode, MAX(due_at) AS due_at, MAX(completed_at) AS completed_at,
           MAX(outcome) AS outcome, MAX(created_at) AS created_at, MAX(is_ai_copy) AS is_ai_copy
    FROM tasks
    GROUP BY id
  )
  SELECT dt.id, dt.title, dt.created_at
  FROM deduped_tasks dt
  ORDER BY dt.created_at DESC, dt.id ASC
  LIMIT ? OFFSET ?
`;

for (let p = 1; p <= 3; p++) {
  const offset = (p - 1) * pageSize;
  const rows = db.prepare(tasksSql).all(pageSize, offset);
  const ids = rows.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log(`Tasks page ${p}: ${rows.length} rows, ${uniqueIds.size} unique IDs`);
}

const tasksCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM tasks`).get();
console.log("Total distinct tasks:", tasksCount.cnt);

db.close();

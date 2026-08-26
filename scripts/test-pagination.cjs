const Database = require("better-sqlite3");
const db = new Database("database/crm.db");

// Test the new paginated deal query
const page = 1;
const pageSize = 25;
const offset = (page - 1) * pageSize;

const sql = `
  SELECT
    d.id,
    d.name,
    COALESCE((SELECT name FROM establishments WHERE id = d.establishment_id), '') AS company,
    COALESCE((SELECT full_name FROM leads WHERE id = d.lead_id), '') AS lead_name,
    d.owner_id,
    COALESCE((SELECT name FROM users WHERE id = d.owner_id), '') AS owner_name,
    d.stage_id,
    COALESCE((SELECT label FROM pipeline_stages WHERE id = d.stage_id), '') AS stage_label,
    COALESCE((SELECT color FROM pipeline_stages WHERE id = d.stage_id), '') AS stage_color,
    COALESCE((SELECT terminal_type FROM pipeline_stages WHERE id = d.stage_id), '') AS terminal_type,
    d.expected_value_minor,
    d.currency_code,
    d.probability_pct,
    d.target_close_date,
    d.created_at,
    d.is_ai_copy
  FROM deals d
  WHERE d.deleted_at IS NULL
  ORDER BY d.created_at DESC, d.id ASC
  LIMIT ? OFFSET ?
`;

const rows = db.prepare(sql).all(pageSize, offset);
console.log("Deals page 1:", rows.length, "records");

const uniqueIds = new Set(rows.map(r => r.id));
console.log("Unique IDs in page 1:", uniqueIds.size);

// Check total count
const countRow = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE deleted_at IS NULL`).get();
console.log("Total distinct deals:", countRow.cnt);

// Test page 2
const rows2 = db.prepare(sql).all(pageSize, offset + pageSize);
console.log("Deals page 2:", rows2.length, "records");
const uniqueIds2 = new Set(rows2.map(r => r.id));
console.log("Unique IDs in page 2:", uniqueIds2.size);

// Check for overlap between pages
const overlap = [...uniqueIds].filter(id => uniqueIds2.has(id));
console.log("Overlap between pages:", overlap.length);

// Test leads
const leadsSql = `
  SELECT
    l.id,
    l.full_name,
    l.normalized_phone,
    l.normalized_email,
    COALESCE((SELECT name FROM establishments WHERE id = l.establishment_id), '') AS company,
    l.primary_source_id AS source_id,
    COALESCE((SELECT label FROM sources WHERE id = l.primary_source_id), '') AS source_label,
    l.stage_id,
    COALESCE((SELECT label FROM pipeline_stages WHERE id = l.stage_id), '') AS stage_label,
    l.owner_id,
    COALESCE((SELECT name FROM users WHERE id = l.owner_id), '') AS owner_name,
    l.created_at,
    l.is_ai_copy
  FROM leads l
  WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
  ORDER BY l.created_at DESC, l.id ASC
  LIMIT ? OFFSET ?
`;

const leadsPage1 = db.prepare(leadsSql).all(25, 0);
console.log("\nLeads page 1:", leadsPage1.length, "records");
const leadsCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM leads WHERE deleted_at IS NULL AND merged_into_id IS NULL`).get();
console.log("Total distinct leads:", leadsCount.cnt);

// Test customers
const custSql = `
  SELECT
    e.id,
    e.name,
    e.city,
    e.created_at,
    e.is_ai_copy
  FROM establishments e
  WHERE e.deleted_at IS NULL
  ORDER BY e.created_at DESC, e.id ASC
  LIMIT ? OFFSET ?
`;

const custPage1 = db.prepare(custSql).all(25, 0);
console.log("\nCustomers page 1:", custPage1.length, "records");
const custCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM establishments WHERE deleted_at IS NULL`).get();
console.log("Total distinct customers:", custCount.cnt);

// Test tasks
const tasksSql = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.entity_type,
    t.entity_id,
    t.assignee_id,
    COALESCE((SELECT name FROM users WHERE id = t.assignee_id), '') AS assignee_name,
    t.task_type_id,
    COALESCE((SELECT label FROM task_types WHERE id = t.task_type_id), '') AS task_type_label,
    t.mode,
    t.due_at,
    t.completed_at,
    t.outcome,
    t.created_at,
    t.is_ai_copy,
    (CASE WHEN t.completed_at IS NOT NULL THEN 'completed' ELSE 'open' END) AS status
  FROM tasks t
  ORDER BY t.created_at DESC, t.id ASC
  LIMIT ? OFFSET ?
`;

const tasksPage1 = db.prepare(tasksSql).all(25, 0);
console.log("\nTasks page 1:", tasksPage1.length, "records");
const tasksCount = db.prepare(`SELECT COUNT(DISTINCT id) as cnt FROM tasks`).get();
console.log("Total distinct tasks:", tasksCount.cnt);

db.close();

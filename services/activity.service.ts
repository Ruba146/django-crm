import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  ActivityFilterOptions,
  ActivityRecord,
  ActivityRecordDetail,
  ActivityTimeline,
  ActivityTimelineItem,
  ActivityType,
} from "@/types";

/**
 * Activity service — reads live data from the existing SQLite CRM database.
 *
 * The Activities page is a CRM-style timeline: the left table shows ONE row
 * per unique record (a Lead, Deal or Customer that has activity history),
 * never one row per activity. Selecting a row loads that record's full
 * activity timeline on demand.
 *
 * Activities are stored in `activities` with `entity_type` + `entity_id`
 * pointing at a `leads` or `deals` row. Tasks are stored in `tasks` with the
 * same shape and are merged into the record timeline. Record display fields
 * (name, company, owner, stage, source, phone, email) are resolved from the
 * related lead/deal/establishment.
 *
 * Every SQL query stays here. No React component ever touches the database.
 * Functions are synchronous (better-sqlite3) and single-responsibility.
 */

/* ------------------------------------------------------------------ */
/* Record list (left table)                                          */
/* ------------------------------------------------------------------ */

interface ActivityRecordRow {
  entity_type: string;
  entity_id: string;
  activity_count: number;
  last_activity_at: string | null;
  activity_type_ids: string[];
}

/** Distinct records that have at least one activity, with aggregate stats. */
export function getActivityRecords(): ActivityRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         a.entity_type,
         a.entity_id,
         COUNT(*) AS activity_count,
         MAX(a.occurred_at) AS last_activity_at,
         COALESCE(
           json_group_array(DISTINCT a.activity_type_id),
           '[]'
         ) AS activity_type_ids
       FROM ${TABLES.activities} a
       WHERE a.entity_type IS NOT NULL AND a.entity_id IS NOT NULL
       GROUP BY a.entity_type, a.entity_id
       ORDER BY last_activity_at DESC`
    )
    .all() as Array<ActivityRecordRow & { activity_type_ids: string }>;

  return rows.map((r) => enrichRecordRow(db, r, r.activity_type_ids));
}

/** Convert a raw grouped row into a display-ready ActivityRecord. */
function enrichRecordRow(
  db: ReturnType<typeof getDb>,
  row: ActivityRecordRow,
  rawTypeIds: string
): ActivityRecord {
  const entityType = row.entity_type;
  const entityId = row.entity_id;
  let name: string | null = null;
  let company: string | null = null;
  let ownerId: string | null = null;
  let ownerName: string | null = null;
  let stageId: string | null = null;
  let stageLabel: string | null = null;
  let stageColor: string | null = null;
  let sourceLabel: string | null = null;
  let sourceColor: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  let leadAiCopy: number | null = null;
  let dealAiCopy: number | null = null;
  let estabAiCopy: number | null = null;

  if (entityType === "lead") {
    const lead = db
      .prepare(
        `SELECT l.id, l.full_name, l.normalized_phone, l.normalized_email,
                l.primary_source_id, l.stage_id, l.owner_id,
                l.establishment_id, e.name AS company,
                s.label AS source_label, s.color AS source_color,
                ps.label AS stage_label, ps.color AS stage_color,
                u.name AS owner_name,
                l.is_ai_copy
         FROM ${TABLES.leads} l
         LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
         WHERE l.id = ? LIMIT 1`
      )
      .get(entityId) as
      | {
          id: string;
          full_name: string | null;
          normalized_phone: string | null;
          normalized_email: string | null;
          primary_source_id: string | null;
          stage_id: string | null;
          owner_id: string | null;
          establishment_id: string | null;
          company: string | null;
          source_label: string | null;
          source_color: string | null;
          stage_label: string | null;
          stage_color: string | null;
          owner_name: string | null;
          is_ai_copy: number | null;
        }
      | undefined;
    if (lead) {
      name = lead.full_name;
      company = lead.company;
      ownerId = lead.owner_id;
      ownerName = lead.owner_name;
      stageId = lead.stage_id;
      stageLabel = lead.stage_label;
      stageColor = lead.stage_color;
      sourceLabel = lead.source_label;
      sourceColor = lead.source_color;
      phone = lead.normalized_phone;
      email = lead.normalized_email;
      leadAiCopy = lead.is_ai_copy;
    }
  } else if (entityType === "deal") {
    const deal = db
      .prepare(
        `SELECT d.id, d.name, d.lead_id, d.stage_id, d.owner_id,
                d.establishment_id, e.name AS company,
                ps.label AS stage_label, ps.color AS stage_color,
                u.name AS owner_name,
                l.full_name AS lead_name, l.normalized_phone, l.normalized_email,
                l.primary_source_id, s.label AS source_label, s.color AS source_color,
                d.is_ai_copy
         FROM ${TABLES.deals} d
         LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
         LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         WHERE d.id = ? LIMIT 1`
      )
      .get(entityId) as
      | {
          id: string;
          name: string | null;
          lead_id: string | null;
          stage_id: string | null;
          owner_id: string | null;
          establishment_id: string | null;
          company: string | null;
          stage_label: string | null;
          stage_color: string | null;
          owner_name: string | null;
          lead_name: string | null;
          normalized_phone: string | null;
          normalized_email: string | null;
          primary_source_id: string | null;
          source_label: string | null;
          source_color: string | null;
          is_ai_copy: number | null;
        }
      | undefined;
    if (deal) {
      name = deal.name;
      company = deal.company;
      ownerId = deal.owner_id;
      ownerName = deal.owner_name;
      stageId = deal.stage_id;
      stageLabel = deal.stage_label;
      stageColor = deal.stage_color;
      sourceLabel = deal.source_label;
      sourceColor = deal.source_color;
      phone = deal.normalized_phone;
      email = deal.normalized_email;
      dealAiCopy = deal.is_ai_copy;
    }
  } else if (entityType === "establishment") {
    const estab = db
      .prepare(
        `SELECT e.id, e.name, e.industry_id, e.is_ai_copy
         FROM ${TABLES.customers} e WHERE e.id = ? LIMIT 1`
      )
      .get(entityId) as { id: string; name: string | null; industry_id: string | null; is_ai_copy: number | null } | undefined;
    if (estab) {
      name = estab.name;
      company = estab.name;
      const lead = db
        .prepare(
          `SELECT l.owner_id, u.name AS owner_name, l.stage_id,
                  ps.label AS stage_label, ps.color AS stage_color,
                  l.primary_source_id, s.label AS source_label, s.color AS source_color,
                  l.normalized_phone, l.normalized_email
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
           LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
           LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
           WHERE l.establishment_id = ? AND l.deleted_at IS NULL
           ORDER BY l.created_at ASC LIMIT 1`
        )
        .get(entityId) as
        | {
            owner_id: string | null;
            owner_name: string | null;
            stage_id: string | null;
            stage_label: string | null;
            stage_color: string | null;
            primary_source_id: string | null;
            source_label: string | null;
            source_color: string | null;
            normalized_phone: string | null;
            normalized_email: string | null;
          }
        | undefined;
      if (lead) {
        ownerId = lead.owner_id;
        ownerName = lead.owner_name;
        stageId = lead.stage_id;
        stageLabel = lead.stage_label;
        stageColor = lead.stage_color;
        sourceLabel = lead.source_label;
        sourceColor = lead.source_color;
        phone = lead.normalized_phone;
        email = lead.normalized_email;
      }
      estabAiCopy = estab.is_ai_copy;
    }
  }

  let typeIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(rawTypeIds);
    if (Array.isArray(parsed)) {
      typeIds = parsed.filter((t): t is string => typeof t === "string");
    }
  } catch {
    typeIds = [];
  }

  const isAiCopy =
    entityType === "lead"
      ? leadAiCopy === 1
      : entityType === "deal"
        ? dealAiCopy === 1
        : entityType === "establishment"
          ? estabAiCopy === 1
          : false;

  return {
    id: `${entityType}:${entityId}`,
    entity_id: entityId,
    entity_type: entityType,
    name,
    company,
    ownerName,
    ownerId,
    stageId,
    last_activity_at: row.last_activity_at,
    activity_count: Number(row.activity_count ?? 0),
    stage:
      stageLabel != null ? { label: stageLabel, color: stageColor } : null,
    source:
      sourceLabel != null ? { label: sourceLabel, color: sourceColor } : null,
    phone,
    email,
    activityTypeIds: typeIds,
    isAiCopy,
  };
}

/* ------------------------------------------------------------------ */
/* Record timeline (detail panel)                                    */
/* ------------------------------------------------------------------ */

/** Resolve a record's display header from its entity type + id. */
function resolveRecordDetail(
  db: ReturnType<typeof getDb>,
  entityType: string,
  entityId: string
): ActivityRecordDetail | null {
  if (entityType === "lead") {
    const lead = db
      .prepare(
        `SELECT l.id, l.full_name, l.normalized_phone, l.normalized_email,
                l.primary_source_id, l.stage_id, l.owner_id,
                e.name AS company,
                s.label AS source_label, s.color AS source_color,
                ps.label AS stage_label, ps.color AS stage_color,
                u.name AS owner_name,
                l.is_ai_copy
         FROM ${TABLES.leads} l
         LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
         WHERE l.id = ? LIMIT 1`
      )
      .get(entityId) as
      | {
          id: string;
          full_name: string | null;
          normalized_phone: string | null;
          normalized_email: string | null;
          primary_source_id: string | null;
          stage_id: string | null;
          owner_id: string | null;
          company: string | null;
          source_label: string | null;
          source_color: string | null;
          stage_label: string | null;
          stage_color: string | null;
          owner_name: string | null;
          is_ai_copy: number | null;
        }
      | undefined;
    if (!lead) return null;
    return {
      id: `lead:${entityId}`,
      entity_id: entityId,
      entity_type: entityType,
      name: lead.full_name,
      company: lead.company,
      ownerName: lead.owner_name,
      stage:
        lead.stage_label != null
          ? { label: lead.stage_label, color: lead.stage_color }
          : null,
      source:
        lead.source_label != null
          ? { label: lead.source_label, color: lead.source_color }
          : null,
      phone: lead.normalized_phone,
      email: lead.normalized_email,
      isAiCopy: lead.is_ai_copy === 1,
    };
  }

  if (entityType === "deal") {
    const deal = db
      .prepare(
        `SELECT d.id, d.name, d.lead_id, d.stage_id, d.owner_id,
                d.establishment_id, e.name AS company,
                ps.label AS stage_label, ps.color AS stage_color,
                u.name AS owner_name,
                l.normalized_phone, l.normalized_email,
                l.primary_source_id, s.label AS source_label, s.color AS source_color,
                d.is_ai_copy
         FROM ${TABLES.deals} d
         LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
         LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         WHERE d.id = ? LIMIT 1`
      )
      .get(entityId) as
      | {
          id: string;
          name: string | null;
          lead_id: string | null;
          stage_id: string | null;
          owner_id: string | null;
          establishment_id: string | null;
          company: string | null;
          stage_label: string | null;
          stage_color: string | null;
          owner_name: string | null;
          normalized_phone: string | null;
          normalized_email: string | null;
          primary_source_id: string | null;
          source_label: string | null;
          source_color: string | null;
          is_ai_copy: number | null;
        }
      | undefined;
    if (!deal) return null;
    return {
      id: `deal:${entityId}`,
      entity_id: entityId,
      entity_type: entityType,
      name: deal.name,
      company: deal.company,
      ownerName: deal.owner_name,
      stage:
        deal.stage_label != null
          ? { label: deal.stage_label, color: deal.stage_color }
          : null,
      source:
        deal.source_label != null
          ? { label: deal.source_label, color: deal.source_color }
          : null,
      phone: deal.normalized_phone,
      email: deal.normalized_email,
      isAiCopy: deal.is_ai_copy === 1,
    };
  }

  if (entityType === "establishment") {
    const estab = db
      .prepare(`SELECT id, name, is_ai_copy FROM ${TABLES.customers} WHERE id = ? LIMIT 1`)
      .get(entityId) as { id: string; name: string | null; is_ai_copy: number | null } | undefined;
    if (!estab) return null;
    const lead = db
      .prepare(
        `SELECT l.owner_id, u.name AS owner_name, l.stage_id,
                ps.label AS stage_label, ps.color AS stage_color,
                l.primary_source_id, s.label AS source_label, s.color AS source_color,
                l.normalized_phone, l.normalized_email
         FROM ${TABLES.leads} l
         LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         WHERE l.establishment_id = ? AND l.deleted_at IS NULL
         ORDER BY l.created_at ASC LIMIT 1`
      )
      .get(entityId) as
      | {
          owner_id: string | null;
          owner_name: string | null;
          stage_id: string | null;
          stage_label: string | null;
          stage_color: string | null;
          primary_source_id: string | null;
          source_label: string | null;
          source_color: string | null;
          normalized_phone: string | null;
          normalized_email: string | null;
        }
      | undefined;
    return {
      id: `establishment:${entityId}`,
      entity_id: entityId,
      entity_type: entityType,
      name: estab.name,
      company: estab.name,
      ownerName: lead?.owner_name ?? null,
      stage:
        lead?.stage_label != null
          ? { label: lead.stage_label, color: lead.stage_color }
          : null,
      source:
        lead?.source_label != null
          ? { label: lead.source_label, color: lead.source_color }
          : null,
      phone: lead?.normalized_phone ?? null,
      email: lead?.normalized_email ?? null,
      isAiCopy: estab.is_ai_copy === 1,
    };
  }

  return null;
}

/**
 * Full timeline for a single record — activities + tasks merged, newest
 * first. Accepts a composite `recordId` of the form `entityType:entityId`.
 */
export function getActivityTimeline(recordId: string): ActivityTimeline | null {
  const colon = recordId.indexOf(":");
  if (colon <= 0) return null;
  const entityType = recordId.slice(0, colon);
  const entityId = recordId.slice(colon + 1);
  const db = getDb();

  const record = resolveRecordDetail(db, entityType, entityId);
  if (!record) return null;

  const activities = db
    .prepare(
      `SELECT
         a.id,
         'activity' AS kind,
         a.activity_type_id,
         at.label AS activity_type_label,
         at.color AS activity_type_color,
         a.body,
         a.direction,
         a.outcome,
         a.duration_seconds,
         u.name AS user_name,
         a.occurred_at,
         a.is_ai_copy
        FROM ${TABLES.activities} a
        LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
        LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
        WHERE a.entity_type = ? AND a.entity_id = ?
        ORDER BY a.occurred_at DESC, a.created_at DESC`
    )
    .all(entityType, entityId) as Array<ActivityTimelineItem & { is_ai_copy: number | null }>;

  const tasks = db
    .prepare(
      `SELECT
         t.id,
         'task' AS kind,
         t.task_type_id AS activity_type_id,
         tt.label AS activity_type_label,
         tt.color AS activity_type_color,
         t.title AS body,
         NULL AS direction,
         NULL AS outcome,
         NULL AS duration_seconds,
         u.name AS user_name,
         COALESCE(t.completed_at, t.due_at, t.created_at) AS occurred_at,
         t.is_ai_copy
        FROM ${TABLES.tasks} t
        LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
        LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
        WHERE t.entity_type = ? AND t.entity_id = ?`
    )
    .all(entityType, entityId) as Array<ActivityTimelineItem & { is_ai_copy: number | null }>;

  const timeline = [...activities, ...tasks].sort((a, b) => {
    const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return tb - ta;
  });

  return {
    record,
    timeline: timeline.map((item) => ({
      ...item,
      isAiCopy: item.is_ai_copy === 1,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Activity detail (kept for API compatibility)                      */
/* ------------------------------------------------------------------ */

/** A single activity row (used by the API route for reference). */
export function getActivityDetail(id: string): { id: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, entity_type, entity_id FROM ${TABLES.activities} WHERE id = ? LIMIT 1`
    )
    .get(id) as { id: string; entity_type: string | null; entity_id: string | null } | undefined;
  if (!row) return null;
  return { id: row.id };
}

/* ------------------------------------------------------------------ */
/* Filter options                                                     */
/* ------------------------------------------------------------------ */

/** Options used to populate the activity records filters. */
export function getActivityFilterOptions(): ActivityFilterOptions {
  const db = getDb();
  const activityTypes = db
    .prepare(
      `SELECT id, label, color, sort_order
       FROM ${TABLES.activity_types}
       WHERE is_archived IS NULL OR is_archived = 0
       ORDER BY sort_order ASC`
    )
    .all() as ActivityType[];
  const users = db
    .prepare(
      `SELECT DISTINCT a.user_id AS id, u.name AS name
       FROM ${TABLES.activities} a
       LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
       WHERE a.user_id IS NOT NULL
       ORDER BY u.name ASC`
    )
    .all() as { id: string; name: string }[];
  const uniqueUsers = Array.from(
    new Map(users.map((u) => [u.id, u])).values()
  );
  const entityTypes = (
    db
      .prepare(`SELECT DISTINCT entity_type FROM ${TABLES.activities} WHERE entity_type IS NOT NULL ORDER BY entity_type ASC`)
      .all() as { entity_type: string }[]
  ).map((r) => r.entity_type);

  return { activityTypes, users: uniqueUsers, entityTypes };
}

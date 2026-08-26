import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import type {
  CreateMemoryInput,
  EntityType,
  FixedGraphData,
  GraphEdge,
  GraphMemory,
  GraphNode,
  GraphSearchResult,
  GraphSubgraph,
  MemoryType,
  UpdateMemoryInput,
} from "@/types/graph";

const MAX_NEIGHBORS = 20;
const MAX_TRAVERSAL = 200;
const MAX_SEARCH = 100;
const MAX_VISIBLE_CHILDREN = 4;

/* ------------------------------------------------------------------ */
/* Node type config                                                   */
/* ------------------------------------------------------------------ */

export const NODE_TYPE_CONFIG = {
  customer: { label: "Customer", color: "#2563eb", table: "establishments" as const },
  lead: { label: "Lead", color: "#06b6d4", table: "leads" as const },
  deal: { label: "Deal", color: "#7c3aed", table: "deals" as const },
  task: { label: "Task", color: "#d97706", table: "tasks" as const },
  activity: { label: "Activity", color: "#db2777", table: "activities" as const },
  user: { label: "Employee", color: "#8b5cf6", table: "users" as const },
  contact: { label: "Contact", color: "#0891b2", table: "contacts" as const },
  memory: { label: "Memory", color: "#dc2626", table: "knowledge_graph_memories" as const },
  note: { label: "Note", color: "#6b7280", table: "notes" as const },
  source: { label: "Source", color: "#059669", table: "sources" as const },
  stage: { label: "Stage", color: "#7c3aed", table: "pipeline_stages" as const },
  industry: { label: "Industry", color: "#0891b2", table: "industries" as const },
  event: { label: "Action", color: "#059669", table: "crm_events" as const },
  task_type: { label: "Task Type", color: "#d97706", table: "task_types" as const },
  activity_type: { label: "Activity Type", color: "#db2777", table: "activity_types" as const },
  lost_reason: { label: "Lost Reason", color: "#dc2626", table: "lost_reasons" as const },
};

/* ------------------------------------------------------------------ */
/* Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeGet<T>(
  query: () => T,
  fallback: T
): T {
  try {
    return query();
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Node resolution                                                    */
/* ------------------------------------------------------------------ */

export function resolveNode(type: EntityType, id: string): GraphNode | null {
  const db = getDb();

  if (type === "customer") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, name FROM ${TABLES.customers} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as
          | { id: string; name: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "customer", label: row.name ?? row.id, sublabel: "Customer", color: NODE_TYPE_CONFIG.customer.color };
  }

  if (type === "lead") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, full_name FROM ${TABLES.leads} WHERE id = ? AND deleted_at IS NULL AND merged_into_id IS NULL LIMIT 1`).get(id) as
          | { id: string; full_name: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "lead", label: row.full_name ?? row.id, sublabel: "Lead", color: NODE_TYPE_CONFIG.lead.color };
  }

  if (type === "deal") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, name FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as
          | { id: string; name: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "deal", label: row.name ?? row.id, sublabel: "Deal", color: NODE_TYPE_CONFIG.deal.color };
  }

  if (type === "task") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, title FROM ${TABLES.tasks} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; title: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "task", label: row.title ?? row.id, sublabel: "Task", color: NODE_TYPE_CONFIG.task.color };
  }

  if (type === "activity") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, body FROM ${TABLES.activities} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; body: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "activity", label: (row.body ?? "").slice(0, 60) || row.id, sublabel: "Activity", color: NODE_TYPE_CONFIG.activity.color };
  }

  if (type === "user") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; name: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "user", label: row.name ?? row.id, sublabel: "Employee", color: NODE_TYPE_CONFIG.user.color };
  }

  if (type === "contact") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, full_name FROM ${TABLES.contacts} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as
          | { id: string; full_name: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "contact", label: row.full_name ?? row.id, sublabel: "Contact", color: NODE_TYPE_CONFIG.contact.color };
  }

  if (type === "memory") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, content, memory_type FROM knowledge_graph_memories WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; content: string; memory_type: string }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "memory", label: row.content.slice(0, 60) || row.id, sublabel: row.memory_type, color: NODE_TYPE_CONFIG.memory.color };
  }

  if (type === "note") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, body FROM ${TABLES.notes} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; body: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "note", label: (row.body ?? "").slice(0, 60) || row.id, sublabel: "Note", color: NODE_TYPE_CONFIG.note.color };
  }

  if (type === "source") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.sources} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "source", label: row.label ?? row.id, sublabel: "Source", color: NODE_TYPE_CONFIG.source.color };
  }

  if (type === "stage") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.stages} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "stage", label: row.label ?? row.id, sublabel: "Stage", color: NODE_TYPE_CONFIG.stage.color };
  }

  if (type === "industry") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.industries} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "industry", label: row.label ?? row.id, sublabel: "Industry", color: NODE_TYPE_CONFIG.industry.color };
  }

  if (type === "event") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, event_type FROM ${TABLES.events} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; event_type: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "event", label: (row.event_type ?? "").replace(/_/g, " ") || row.id, sublabel: "Event", color: NODE_TYPE_CONFIG.event.color };
  }

  if (type === "task_type") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.task_types} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "task_type", label: row.label ?? row.id, sublabel: "Task Type", color: NODE_TYPE_CONFIG.task_type.color };
  }

  if (type === "activity_type") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.activity_types} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "activity_type", label: row.label ?? row.id, sublabel: "Activity Type", color: NODE_TYPE_CONFIG.activity_type.color };
  }

  if (type === "lost_reason") {
    const row = safeGet(
      () =>
        db.prepare(`SELECT id, label FROM ${TABLES.lost_reasons} WHERE id = ? LIMIT 1`).get(id) as
          | { id: string; label: string | null }
          | undefined,
      undefined
    );
    if (!row) return null;
    return { id: row.id, type: "lost_reason", label: row.label ?? row.id, sublabel: "Lost Reason", color: NODE_TYPE_CONFIG.lost_reason.color };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Neighbor discovery                                                  */
/* ------------------------------------------------------------------ */

interface RawEdge {
  rel: string;
  neighbor_type: EntityType;
  neighbor_id: string;
  label: string;
}

export function getNeighbors(type: EntityType, id: string): { edges: GraphEdge[]; nodes: GraphNode[] } {
  const db = getDb();
  const edgeMap = new Map<string, GraphEdge>();
  const nodeMap = new Map<string, GraphNode>();

  const push = (edge: RawEdge) => {
    const node = resolveNode(edge.neighbor_type, edge.neighbor_id);
    if (!node) return;
    const edgeId = `${type}:${id}:${edge.rel}:${edge.neighbor_type}:${edge.neighbor_id}`;
    if (edgeMap.has(edgeId)) return;
    edgeMap.set(edgeId, { id: edgeId, source: `${type}:${id}`, target: `${edge.neighbor_type}:${edge.neighbor_id}`, relationship: edge.rel, label: edge.label });
    nodeMap.set(node.id, node);
  };

  if (type === "customer") {
    const leads = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const l of leads) push({ rel: "CUSTOMER_HAS_LEAD", neighbor_type: "lead", neighbor_id: l.id, label: "Has Lead" });

    const contacts = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.contacts} WHERE establishment_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const c of contacts) push({ rel: "CUSTOMER_HAS_CONTACT", neighbor_type: "contact", neighbor_id: c.id, label: "Contact" });

    const dealIds = safeGet(
      () =>
        db.prepare(`SELECT DISTINCT d.id FROM ${TABLES.deals} d WHERE d.establishment_id = ? AND d.deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const d of dealIds) push({ rel: "CUSTOMER_HAS_DEAL", neighbor_type: "deal", neighbor_id: d.id, label: "Deal" });

    const firstLead = safeGet(
      () =>
        db.prepare(`SELECT owner_id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL AND owner_id IS NOT NULL LIMIT 1`).get(id) as { owner_id: string } | undefined,
      undefined
    );
    if (firstLead?.owner_id) push({ rel: "CUSTOMER_ASSIGNED_TO", neighbor_type: "user", neighbor_id: firstLead.owner_id, label: "Assigned To" });

    const activityIds = safeGet(
      () =>
        db
          .prepare(
            `SELECT a.id FROM ${TABLES.activities} a WHERE a.entity_type = 'lead' AND a.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL) LIMIT ?`
          )
          .all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const a of activityIds) push({ rel: "CUSTOMER_HAS_ACTIVITY", neighbor_type: "activity", neighbor_id: a.id, label: "Activity" });

    const taskIds = safeGet(
      () =>
        db
          .prepare(
            `SELECT t.id FROM ${TABLES.tasks} t WHERE t.entity_type = 'lead' AND t.entity_id IN (SELECT id FROM ${TABLES.leads} WHERE establishment_id = ? AND deleted_at IS NULL) LIMIT ?`
          )
          .all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const t of taskIds) push({ rel: "CUSTOMER_HAS_TASK", neighbor_type: "task", neighbor_id: t.id, label: "Task" });

    const customerTaskIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.tasks} WHERE entity_type IN ('establishment', 'company') AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const t of customerTaskIds) push({ rel: "CUSTOMER_HAS_TASK", neighbor_type: "task", neighbor_id: t.id, label: "Task" });

    const noteIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.notes} WHERE entity_type = 'establishment' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const n of noteIds) push({ rel: "CUSTOMER_HAS_NOTE", neighbor_type: "note", neighbor_id: n.id, label: "Note" });

    const industryId = safeGet(
      () =>
        db.prepare(`SELECT industry_id FROM ${TABLES.customers} WHERE id = ? AND industry_id IS NOT NULL LIMIT 1`).get(id) as { industry_id: string } | undefined,
      undefined
    );
    if (industryId?.industry_id) push({ rel: "CUSTOMER_IN_INDUSTRY", neighbor_type: "industry", neighbor_id: industryId.industry_id, label: "Industry" });
  }

  if (type === "lead") {
    const customer = safeGet(
      () =>
        db.prepare(`SELECT establishment_id FROM ${TABLES.leads} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as { establishment_id: string | null } | undefined,
      undefined
    );
    if (customer?.establishment_id) push({ rel: "LEAD_BELONGS_TO_CUSTOMER", neighbor_type: "customer", neighbor_id: customer.establishment_id, label: "Customer" });

    const deals = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.deals} WHERE lead_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const d of deals) push({ rel: "LEAD_HAS_DEAL", neighbor_type: "deal", neighbor_id: d.id, label: "Deal" });

    const owner = safeGet(
      () =>
        db.prepare(`SELECT owner_id FROM ${TABLES.leads} WHERE id = ? AND owner_id IS NOT NULL LIMIT 1`).get(id) as { owner_id: string } | undefined,
      undefined
    );
    if (owner?.owner_id) push({ rel: "LEAD_OWNED_BY", neighbor_type: "user", neighbor_id: owner.owner_id, label: "Owner" });

    const activityIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.activities} WHERE entity_type = 'lead' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const a of activityIds) push({ rel: "LEAD_HAS_ACTIVITY", neighbor_type: "activity", neighbor_id: a.id, label: "Activity" });

    const taskIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.tasks} WHERE entity_type = 'lead' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const t of taskIds) push({ rel: "LEAD_HAS_TASK", neighbor_type: "task", neighbor_id: t.id, label: "Task" });

    const noteIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.notes} WHERE entity_type = 'lead' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const n of noteIds) push({ rel: "LEAD_HAS_NOTE", neighbor_type: "note", neighbor_id: n.id, label: "Note" });

    const lead = safeGet(
      () =>
        db.prepare(`SELECT primary_source_id, stage_id FROM ${TABLES.leads} WHERE id = ? LIMIT 1`).get(id) as { primary_source_id: string | null; stage_id: string | null } | undefined,
      undefined
    );
    if (lead?.primary_source_id) push({ rel: "LEAD_SOURCE", neighbor_type: "source", neighbor_id: lead.primary_source_id, label: "Source" });
    if (lead?.stage_id) push({ rel: "LEAD_STAGE", neighbor_type: "stage", neighbor_id: lead.stage_id, label: "Stage" });
  }

  if (type === "deal") {
    const lead = safeGet(
      () =>
        db.prepare(`SELECT lead_id, establishment_id FROM ${TABLES.deals} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as { lead_id: string | null; establishment_id: string | null } | undefined,
      undefined
    );
    if (lead?.lead_id) push({ rel: "DEAL_BELONGS_TO_LEAD", neighbor_type: "lead", neighbor_id: lead.lead_id, label: "Lead" });
    if (lead?.establishment_id) push({ rel: "DEAL_BELONGS_TO_CUSTOMER", neighbor_type: "customer", neighbor_id: lead.establishment_id, label: "Customer" });

    const owner = safeGet(
      () =>
        db.prepare(`SELECT owner_id FROM ${TABLES.deals} WHERE id = ? AND owner_id IS NOT NULL LIMIT 1`).get(id) as { owner_id: string } | undefined,
      undefined
    );
    if (owner?.owner_id) push({ rel: "DEAL_OWNED_BY", neighbor_type: "user", neighbor_id: owner.owner_id, label: "Owner" });

    const activityIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.activities} WHERE entity_type = 'deal' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const a of activityIds) push({ rel: "DEAL_HAS_ACTIVITY", neighbor_type: "activity", neighbor_id: a.id, label: "Activity" });

    const taskIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.tasks} WHERE entity_type = 'deal' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const t of taskIds) push({ rel: "DEAL_HAS_TASK", neighbor_type: "task", neighbor_id: t.id, label: "Task" });

    const noteIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.notes} WHERE entity_type = 'deal' AND entity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const n of noteIds) push({ rel: "DEAL_HAS_NOTE", neighbor_type: "note", neighbor_id: n.id, label: "Note" });

    const deal = safeGet(
      () =>
        db.prepare(`SELECT stage_id, lost_reason_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`).get(id) as { stage_id: string | null; lost_reason_id: string | null } | undefined,
      undefined
    );
    if (deal?.stage_id) push({ rel: "DEAL_STAGE", neighbor_type: "stage", neighbor_id: deal.stage_id, label: "Stage" });
    if (deal?.lost_reason_id) push({ rel: "DEAL_LOST_REASON", neighbor_type: "lost_reason", neighbor_id: deal.lost_reason_id, label: "Lost Reason" });
  }

  if (type === "task") {
    const assignee = safeGet(
      () =>
        db.prepare(`SELECT assignee_id FROM ${TABLES.tasks} WHERE id = ? AND assignee_id IS NOT NULL LIMIT 1`).get(id) as { assignee_id: string } | undefined,
      undefined
    );
    if (assignee?.assignee_id) push({ rel: "TASK_ASSIGNED_TO", neighbor_type: "user", neighbor_id: assignee.assignee_id, label: "Assigned To" });

    const task = safeGet(
      () =>
        db.prepare(`SELECT entity_type, entity_id FROM ${TABLES.tasks} WHERE id = ? LIMIT 1`).get(id) as { entity_type: string | null; entity_id: string | null } | undefined,
      undefined
    );
    if (task?.entity_type && task?.entity_id) {
      const neighborType = task.entity_type === "lead" ? "lead" : task.entity_type === "deal" ? "deal" : task.entity_type === "establishment" || task.entity_type === "company" ? "customer" : null;
      if (neighborType) push({ rel: "TASK_ATTACHED_TO", neighbor_type: neighborType, neighbor_id: task.entity_id, label: "Attached To" });
    }

    const taskType = safeGet(
      () =>
        db.prepare(`SELECT task_type_id FROM ${TABLES.tasks} WHERE id = ? AND task_type_id IS NOT NULL LIMIT 1`).get(id) as { task_type_id: string } | undefined,
      undefined
    );
    if (taskType?.task_type_id) push({ rel: "TASK_TYPE", neighbor_type: "task_type", neighbor_id: taskType.task_type_id, label: "Type" });
  }

  if (type === "activity") {
    const activity = safeGet(
      () =>
        db.prepare(`SELECT entity_type, entity_id, user_id, activity_type_id FROM ${TABLES.activities} WHERE id = ? LIMIT 1`).get(id) as { entity_type: string | null; entity_id: string | null; user_id: string | null; activity_type_id: string | null } | undefined,
      undefined
    );
    if (activity?.entity_type && activity?.entity_id) {
      const neighborType = activity.entity_type === "lead" ? "lead" : activity.entity_type === "deal" ? "deal" : activity.entity_type === "establishment" ? "customer" : null;
      if (neighborType) push({ rel: "ACTIVITY_ATTACHED_TO", neighbor_type: neighborType, neighbor_id: activity.entity_id, label: "For" });
    }
    if (activity?.user_id) push({ rel: "ACTIVITY_PERFORMED_BY", neighbor_type: "user", neighbor_id: activity.user_id, label: "By" });
    if (activity?.activity_type_id) push({ rel: "ACTIVITY_TYPE", neighbor_type: "activity_type", neighbor_id: activity.activity_type_id, label: "Type" });

    const mentionIds = safeGet(
      () =>
        db.prepare(`SELECT mentioned_user_id FROM ${TABLES.activity_mentions} WHERE activity_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { mentioned_user_id: string }[],
      []
    );
    for (const m of mentionIds) push({ rel: "ACTIVITY_MENTIONS", neighbor_type: "user", neighbor_id: m.mentioned_user_id, label: "Mentions" });
  }

  if (type === "user") {
    const ownedLeads = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.leads} WHERE owner_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const l of ownedLeads) push({ rel: "USER_OWNS_LEAD", neighbor_type: "lead", neighbor_id: l.id, label: "Owns" });

    const ownedDeals = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.deals} WHERE owner_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const d of ownedDeals) push({ rel: "USER_OWNS_DEAL", neighbor_type: "deal", neighbor_id: d.id, label: "Owns" });

    const assignedTasks = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.tasks} WHERE assignee_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const t of assignedTasks) push({ rel: "USER_ASSIGNED_TASK", neighbor_type: "task", neighbor_id: t.id, label: "Assigned" });

    const performedActivities = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.activities} WHERE user_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const a of performedActivities) push({ rel: "USER_PERFORMED_ACTIVITY", neighbor_type: "activity", neighbor_id: a.id, label: "Performed" });

    const authoredNotes = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.notes} WHERE author_id = ? LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const n of authoredNotes) push({ rel: "USER_AUTHORED_NOTE", neighbor_type: "note", neighbor_id: n.id, label: "Note" });
  }

  if (type === "contact") {
    const customer = safeGet(
      () =>
        db.prepare(`SELECT establishment_id FROM ${TABLES.contacts} WHERE id = ? AND deleted_at IS NULL LIMIT 1`).get(id) as { establishment_id: string | null } | undefined,
      undefined
    );
    if (customer?.establishment_id) push({ rel: "CONTACT_BELONGS_TO_CUSTOMER", neighbor_type: "customer", neighbor_id: customer.establishment_id, label: "Customer" });
  }

  if (type === "memory") {
    const mem = safeGet(
      () =>
        db.prepare(`SELECT entity_type, entity_id FROM knowledge_graph_memories WHERE id = ? LIMIT 1`).get(id) as { entity_type: string; entity_id: string } | undefined,
      undefined
    );
    if (mem) {
      const neighborType = mem.entity_type === "lead" ? "lead" : mem.entity_type === "deal" ? "deal" : mem.entity_type === "establishment" ? "customer" : mem.entity_type;
      push({ rel: "MEMORY_RELATES_TO", neighbor_type: neighborType as EntityType, neighbor_id: mem.entity_id, label: "Relates To" });
    }
  }

  if (type === "note") {
    const note = safeGet(
      () =>
        db.prepare(`SELECT entity_type, entity_id, author_id FROM ${TABLES.notes} WHERE id = ? LIMIT 1`).get(id) as { entity_type: string | null; entity_id: string | null; author_id: string | null } | undefined,
      undefined
    );
    if (note?.entity_type && note?.entity_id) {
      const neighborType = note.entity_type === "lead" ? "lead" : note.entity_type === "deal" ? "deal" : note.entity_type === "establishment" ? "customer" : note.entity_type === "task" ? "task" : note.entity_type === "activity" ? "activity" : null;
      if (neighborType) push({ rel: "NOTE_ATTACHED_TO", neighbor_type: neighborType, neighbor_id: note.entity_id, label: "For" });
    }
    if (note?.author_id) push({ rel: "NOTE_AUTHORED_BY", neighbor_type: "user", neighbor_id: note.author_id, label: "Author" });
  }

  if (type === "event") {
    const evt = safeGet(
      () =>
        db.prepare(`SELECT entity_type, entity_id, actor_id FROM ${TABLES.events} WHERE id = ? LIMIT 1`).get(id) as { entity_type: string | null; entity_id: string | null; actor_id: string | null } | undefined,
      undefined
    );
    if (evt?.entity_type && evt?.entity_id) {
      const neighborType = evt.entity_type === "lead" ? "lead" : evt.entity_type === "deal" ? "deal" : evt.entity_type === "establishment" ? "customer" : evt.entity_type === "task" ? "task" : evt.entity_type === "activity" ? "activity" : evt.entity_type === "note" ? "note" : null;
      if (neighborType) push({ rel: "EVENT_FOR", neighbor_type: neighborType, neighbor_id: evt.entity_id, label: "For" });
    }
    if (evt?.actor_id) push({ rel: "EVENT_ACTOR", neighbor_type: "user", neighbor_id: evt.actor_id, label: "Actor" });
  }

  if (type === "source") {
    const leadIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.leads} WHERE primary_source_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const l of leadIds) push({ rel: "SOURCE_HAS_LEAD", neighbor_type: "lead", neighbor_id: l.id, label: "Lead" });
  }

  if (type === "stage") {
    const leadIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.leads} WHERE stage_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const l of leadIds) push({ rel: "STAGE_HAS_LEAD", neighbor_type: "lead", neighbor_id: l.id, label: "Lead" });

    const dealIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.deals} WHERE stage_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const d of dealIds) push({ rel: "STAGE_HAS_DEAL", neighbor_type: "deal", neighbor_id: d.id, label: "Deal" });
  }

  if (type === "industry") {
    const customerIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.customers} WHERE industry_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const c of customerIds) push({ rel: "INDUSTRY_HAS_CUSTOMER", neighbor_type: "customer", neighbor_id: c.id, label: "Customer" });
  }

  if (type === "lost_reason") {
    const dealIds = safeGet(
      () =>
        db.prepare(`SELECT id FROM ${TABLES.deals} WHERE lost_reason_id = ? AND deleted_at IS NULL LIMIT ?`).all(id, MAX_NEIGHBORS) as { id: string }[],
      []
    );
    for (const d of dealIds) push({ rel: "LOST_REASON_FOR_DEAL", neighbor_type: "deal", neighbor_id: d.id, label: "Deal" });
  }

  return { edges: Array.from(edgeMap.values()), nodes: Array.from(nodeMap.values()) };
}

/* ------------------------------------------------------------------ */
/* Bounded subgraph traversal                                          */
/* ------------------------------------------------------------------ */

export function getSubgraph(type: EntityType, id: string, maxDepth = 2): GraphSubgraph {
  const nodes = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();
  const visited = new Set<string>();
  const queue: { type: EntityType; id: string; depth: number }[] = [{ type, id, depth: 0 }];

  const root = resolveNode(type, id);
  if (!root) return { nodes: [], edges: [] };
  nodes.set(`${type}:${id}`, root);
  visited.add(`${type}:${id}`);

  while (queue.length > 0 && nodes.size < MAX_TRAVERSAL) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const { edges: neighborEdges } = getNeighbors(current.type, current.id);
    for (const edge of neighborEdges) {
      if (nodes.size >= MAX_TRAVERSAL) break;
      const targetKey = edge.target;
      if (!visited.has(targetKey)) {
        visited.add(targetKey);
        const [t, nid] = targetKey.split(":") as [EntityType, string];
        const node = resolveNode(t, nid);
        if (node) {
          nodes.set(targetKey, node);
          if (current.depth + 1 < maxDepth) {
            queue.push({ type: t, id: nid, depth: current.depth + 1 });
          }
        }
      }
      if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
    }
  }

  return { nodes: Array.from(nodes.values()), edges: Array.from(edgeMap.values()) };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function searchNodes(query: string): GraphSearchResult[] {
  if (!query.trim()) return [];
  const db = getDb();
  const term = `%${query.trim()}%`;
  const results: GraphSearchResult[] = [];

  const rows = safeGet(
    () =>
      db
        .prepare(
          `SELECT 'customer' AS type, id, name AS label, is_ai_copy FROM ${TABLES.customers} WHERE deleted_at IS NULL AND (name LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'lead' AS type, id, full_name AS label, is_ai_copy FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL AND (full_name LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'deal' AS type, d.id, d.name AS label, d.is_ai_copy FROM ${TABLES.deals} d WHERE d.deleted_at IS NULL AND (d.name LIKE ? OR d.id LIKE ?)
           UNION ALL
           SELECT 'user' AS type, id, name AS label, 0 AS is_ai_copy FROM ${TABLES.users} WHERE (name LIKE ? OR id LIKE ? OR email LIKE ?)
           UNION ALL
           SELECT 'contact' AS type, id, full_name AS label, 0 AS is_ai_copy FROM ${TABLES.contacts} WHERE deleted_at IS NULL AND (full_name LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'task' AS type, id, title AS label, is_ai_copy FROM ${TABLES.tasks} WHERE (title LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'activity' AS type, id, body AS label, is_ai_copy FROM ${TABLES.activities} WHERE (body LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'note' AS type, id, body AS label, is_ai_copy FROM ${TABLES.notes} WHERE (body LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'source' AS type, id, label AS label, 0 AS is_ai_copy FROM ${TABLES.sources} WHERE (label LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'stage' AS type, id, label AS label, 0 AS is_ai_copy FROM ${TABLES.stages} WHERE (label LIKE ? OR id LIKE ?)
           UNION ALL
           SELECT 'industry' AS type, id, label AS label, 0 AS is_ai_copy FROM ${TABLES.industries} WHERE (label LIKE ? OR id LIKE ?)
          `
        )
        .all(
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term,
          term
         ) as Array<{ type: string; id: string; label: string; is_ai_copy: number | null }>,
    []
  );

  for (const row of rows) {
    const resultItem = {
      id: row.id,
      type: row.type as EntityType,
      label: row.label ?? row.id,
      isAiCopy: row.is_ai_copy === 1,
    };
    results.push(resultItem);
  }

  const uniqueResults = Array.from(
    new Map(results.map((r) => [`${r.type}:${r.id}`, r])).values()
  );

  for (let i = uniqueResults.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueResults[i], uniqueResults[j]] = [uniqueResults[j], uniqueResults[i]];
  }

  return uniqueResults.slice(0, MAX_SEARCH);
}

export function searchAllEntities(query: string): Array<{
  type: string;
  id: string;
  label: string;
  is_ai_copy: number | null;
  secondary_text: string | null;
}> {
  const db = getDb();
  const rows: Array<{
    type: string;
    id: string;
    label: string;
    is_ai_copy: number | null;
    secondary_text: string | null;
  }> = [];

  if (!query.trim()) {
    const customers = safeGet(
      () => db.prepare(`SELECT id, name, is_ai_copy FROM ${TABLES.customers} WHERE deleted_at IS NULL LIMIT 20`).all() as Array<{ id: string; name: string; is_ai_copy: number }>,
      []
    );
    for (const row of customers) {
      rows.push({ type: "customer", id: row.id, label: row.name, is_ai_copy: row.is_ai_copy, secondary_text: row.name });
    }

    const leads = safeGet(
      () => db.prepare(`SELECT id, full_name, is_ai_copy FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL LIMIT 20`).all() as Array<{ id: string; full_name: string; is_ai_copy: number }>,
      []
    );
    for (const row of leads) {
      rows.push({ type: "lead", id: row.id, label: row.full_name, is_ai_copy: row.is_ai_copy, secondary_text: "" });
    }

    const deals = safeGet(
      () =>
        db
          .prepare(
            `SELECT d.id, d.name, d.is_ai_copy, COALESCE(ec.name, '') || COALESCE(' · ' || ps.label, '') AS secondary_text FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} ec ON ec.id = d.establishment_id LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id WHERE d.deleted_at IS NULL LIMIT 20`
          )
          .all() as Array<{ id: string; name: string; is_ai_copy: number; secondary_text: string }>,
      []
    );
    for (const row of deals) {
      rows.push({ type: "deal", id: row.id, label: row.name, is_ai_copy: row.is_ai_copy, secondary_text: row.secondary_text });
    }

    const users = safeGet(
      () => db.prepare(`SELECT id, name, email FROM ${TABLES.users} LIMIT 20`).all() as Array<{ id: string; name: string; email: string }>,
      []
    );
    for (const row of users) {
      rows.push({ type: "user", id: row.id, label: row.name, is_ai_copy: 0, secondary_text: row.email });
    }
  } else {
    const term = `%${query.trim()}%`;
    const rawRows = safeGet(
      () =>
        db
          .prepare(
            `SELECT 'customer' AS type, id, name AS label, is_ai_copy, name AS secondary_text FROM ${TABLES.customers} WHERE deleted_at IS NULL AND name LIKE ?
             UNION ALL
             SELECT 'lead' AS type, id, full_name AS label, is_ai_copy, '' AS secondary_text FROM ${TABLES.leads} WHERE deleted_at IS NULL AND merged_into_id IS NULL AND full_name LIKE ?
             UNION ALL
             SELECT 'deal' AS type, d.id, d.name AS label, d.is_ai_copy, COALESCE(ec.name, '') || COALESCE(' · ' || ps.label, '') AS secondary_text FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} ec ON ec.id = d.establishment_id LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id WHERE d.deleted_at IS NULL AND d.name LIKE ?
             UNION ALL
             SELECT 'user' AS type, id, name AS label, 0 AS is_ai_copy, COALESCE(email, '') AS secondary_text FROM ${TABLES.users} WHERE name LIKE ?
             LIMIT ?
            `
          )
          .all(term, term, term, term, MAX_SEARCH) as Array<{
            type: string;
            id: string;
            label: string;
            is_ai_copy: number | null;
            secondary_text: string | null;
          }>,
      []
    );
    rows.push(...rawRows);
  }

  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.type}:${row.id}`;
    if (!unique.has(key)) unique.set(key, row);
  }

  return Array.from(unique.values());
}

/* ------------------------------------------------------------------ */
/* Record detail enrichment                                           */
/* ------------------------------------------------------------------ */

export function getRecordDetails(type: EntityType, id: string): Record<string, unknown> | null {
  const db = getDb();

  if (type === "deal") {
    const row = db.prepare(
      `SELECT d.*, e.name AS company_name, l.full_name AS lead_name, u.name AS owner_name, ps.label AS stage_label, ps.color AS stage_color, ps.terminal_type
       FROM ${TABLES.deals} d
       LEFT JOIN ${TABLES.customers} e ON e.id = d.establishment_id
       LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id
       LEFT JOIN ${TABLES.users} u ON u.id = d.owner_id
       LEFT JOIN ${TABLES.stages} ps ON ps.id = d.stage_id
       WHERE d.id = ? AND d.deleted_at IS NULL
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  if (type === "lead") {
    const row = db.prepare(
      `SELECT l.*, e.name AS company_name, e.city AS company_city, s.label AS source_label, s.color AS source_color, ps.label AS stage_label, ps.color AS stage_color, ps.is_terminal, u.name AS owner_name
       FROM ${TABLES.leads} l
       LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id
       LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
       LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
       LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
       WHERE l.id = ? AND l.deleted_at IS NULL AND l.merged_into_id IS NULL
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  if (type === "customer") {
    const row = db.prepare(
      `SELECT e.*, i.label AS industry_label, i.color AS industry_color
       FROM ${TABLES.customers} e
       LEFT JOIN ${TABLES.industries} i ON i.id = e.industry_id
       WHERE e.id = ? AND e.deleted_at IS NULL
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    const ctx = db
      .prepare(
        `SELECT s.label AS source_label, s.color AS source_color, ps.label AS status_label, ps.color AS status_color, u.name AS owner_name
         FROM ${TABLES.leads} l
         LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
         LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
         LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
         WHERE l.establishment_id = ? AND l.deleted_at IS NULL
         ORDER BY l.created_at ASC
         LIMIT 1`
      )
      .get(id) as Record<string, unknown> | undefined;

    return { ...row, ...(ctx || {}) };
  }

  if (type === "task") {
    const row = db.prepare(
      `SELECT t.*, tt.label AS task_type_label, tt.color AS task_type_color, u.name AS assignee_name
       FROM ${TABLES.tasks} t
       LEFT JOIN ${TABLES.task_types} tt ON tt.id = t.task_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = t.assignee_id
       WHERE t.id = ?
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  if (type === "activity") {
    const row = db.prepare(
      `SELECT a.*, at.label AS activity_type_label, at.color AS activity_type_color, u.name AS user_name
       FROM ${TABLES.activities} a
       LEFT JOIN ${TABLES.activity_types} at ON at.id = a.activity_type_id
       LEFT JOIN ${TABLES.users} u ON u.id = a.user_id
       WHERE a.id = ?
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  if (type === "user") {
    const row = db.prepare(`SELECT * FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  if (type === "contact") {
    const row = db.prepare(
      `SELECT c.*, e.name AS company_name
       FROM ${TABLES.contacts} c
       LEFT JOIN ${TABLES.customers} e ON e.id = c.establishment_id
       WHERE c.id = ? AND c.deleted_at IS NULL
       LIMIT 1`
    ).get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Memory CRUD                                                         */
/* ------------------------------------------------------------------ */

export function createMemory(input: CreateMemoryInput): GraphMemory {
  const db = getDb();
  const id = `mem_${uuid()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO knowledge_graph_memories (id, entity_type, entity_id, memory_type, content, metadata, source, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.entity_type,
    input.entity_id,
    input.memory_type,
    input.content,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.source ?? null,
    input.created_by ?? null,
    now,
    now
  );

  return {
    id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    memory_type: input.memory_type,
    content: input.content,
    metadata: input.metadata,
    source: input.source,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  };
}

export function getMemories(entityType: EntityType, entityId: string): GraphMemory[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, entity_type, entity_id, memory_type, content, metadata, source, created_by, created_at, updated_at
       FROM knowledge_graph_memories
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC`
    )
    .all(entityType, entityId) as Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    memory_type: string;
    content: string;
    metadata: string | null;
    source: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => {
    const rawMetadata = r.metadata;
    const metadata = rawMetadata ? safeGet(() => JSON.parse(rawMetadata), undefined) : undefined;
    return {
      id: r.id,
      entity_type: r.entity_type as EntityType,
      entity_id: r.entity_id,
      memory_type: r.memory_type as MemoryType,
      content: r.content,
      metadata,
      source: r.source ?? undefined,
      created_by: r.created_by ?? undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

export function getMemory(id: string): GraphMemory | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, entity_type, entity_id, memory_type, content, metadata, source, created_by, created_at, updated_at
       FROM knowledge_graph_memories
       WHERE id = ? LIMIT 1`
    )
    .get(id) as
      | { id: string; entity_type: string; entity_id: string; memory_type: string; content: string; metadata: string | null; source: string | null; created_by: string | null; created_at: string; updated_at: string }
      | undefined;

  if (!row) return null;

  const rawMetadata = row.metadata;
  const metadata = rawMetadata ? safeGet(() => JSON.parse(rawMetadata), undefined) : undefined;

  return {
    id: row.id,
    entity_type: row.entity_type as EntityType,
    entity_id: row.entity_id,
    memory_type: row.memory_type as MemoryType,
    content: row.content,
    metadata,
    source: row.source ?? undefined,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function updateMemory(id: string, input: UpdateMemoryInput): GraphMemory | null {
  const db = getDb();
  const existing = getMemory(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const memoryType = input.memory_type ?? existing.memory_type;
  const content = input.content ?? existing.content;
  const metadata = input.metadata !== undefined ? input.metadata : existing.metadata;
  const source = input.source !== undefined ? input.source : existing.source;

  db.prepare(
    `UPDATE knowledge_graph_memories SET memory_type = ?, content = ?, metadata = ?, source = ?, updated_at = ? WHERE id = ?`
  ).run(memoryType, content, metadata ? JSON.stringify(metadata) : null, source ?? null, now, id);

  return { ...existing, memory_type: memoryType, content, metadata, source, updated_at: now };
}

export function deleteMemory(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM knowledge_graph_memories WHERE id = ?`).run(id);
  return result.changes > 0;
}

/* ------------------------------------------------------------------ */
/* Fixed graph data for deterministic layout                           */
/* ------------------------------------------------------------------ */

function resolveUser(db: ReturnType<typeof getDb>, userId: string): GraphNode | null {
  const row = safeGet(
    () => db.prepare(`SELECT id, name, email, roles FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(userId) as
      | { id: string; name: string | null; email: string | null; roles: string | null }
      | undefined,
    undefined
  );
  if (!row) return null;
  return {
    id: row.id,
    type: "user",
    label: row.name ?? row.id,
    sublabel: "Employee",
    color: NODE_TYPE_CONFIG.user.color,
    metadata: { email: row.email, roles: row.roles },
  };
}

export function getFixedGraphData(type: EntityType, id: string): FixedGraphData | null {
  const db = getDb();
  const root = resolveNode(type, id);
  if (!root) return null;

  const ownerNodes: GraphNode[] = [];
  const userNodes: GraphNode[] = [];
  const taskNodes: GraphNode[] = [];
  const activityNodes: GraphNode[] = [];
  const actionNodes: GraphNode[] = [];
  const relatedNodes: GraphNode[] = [];
  const leadsNodes: GraphNode[] = [];

  const seen = new Set<string>();

  function addNode(node: GraphNode, category: "owner" | "users" | "tasks" | "activities" | "actions" | "related" | "leads") {
    const key = `${node.type}:${node.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    switch (category) {
      case "owner": ownerNodes.push(node); break;
      case "users": userNodes.push(node); break;
      case "tasks": taskNodes.push(node); break;
      case "activities": activityNodes.push(node); break;
      case "actions": actionNodes.push(node); break;
      case "related": relatedNodes.push(node); break;
      case "leads": leadsNodes.push(node); break;
    }
  }

  const ownerUserId = safeGet<string | null>(() => {
    if (type === "lead") {
      const row = db.prepare(`SELECT owner_id FROM ${TABLES.leads} WHERE id = ? AND owner_id IS NOT NULL LIMIT 1`).get(id) as
        { owner_id: string } | undefined;
      return row?.owner_id ?? null;
    }
    if (type === "deal") {
      const row = db.prepare(`SELECT owner_id FROM ${TABLES.deals} WHERE id = ? AND owner_id IS NOT NULL LIMIT 1`).get(id) as
        { owner_id: string } | undefined;
      return row?.owner_id ?? null;
    }
    if (type === "customer") {
      const row = db.prepare(`SELECT owner_id FROM ${TABLES.leads} WHERE establishment_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL LIMIT 1`).get(id) as
        { owner_id: string } | undefined;
      return row?.owner_id ?? null;
    }
    if (type === "task") {
      const row = db.prepare(`SELECT assignee_id FROM ${TABLES.tasks} WHERE id = ? AND assignee_id IS NOT NULL LIMIT 1`).get(id) as
        { assignee_id: string } | undefined;
      return row?.assignee_id ?? null;
    }
    if (type === "activity") {
      const row = db.prepare(`SELECT user_id FROM ${TABLES.activities} WHERE id = ? AND user_id IS NOT NULL LIMIT 1`).get(id) as
        { user_id: string } | undefined;
      return row?.user_id ?? null;
    }
    return null;
  }, null);

  if (ownerUserId) {
    const owner = resolveUser(db, ownerUserId);
    if (owner) addNode(owner, "owner");
  }

  const userIds = new Set<string>();
  if (ownerUserId) userIds.add(ownerUserId);

  const userRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT DISTINCT u.id, u.name, u.email, u.roles
           FROM ${TABLES.users} u
           WHERE u.id != ?
           AND (
             u.id IN (SELECT user_id FROM ${TABLES.activities} WHERE entity_type = ? AND entity_id = ?)
             OR u.id IN (SELECT assignee_id FROM ${TABLES.tasks} WHERE entity_type = ? AND entity_id = ?)
             OR u.id IN (SELECT mentioned_user_id FROM ${TABLES.activity_mentions} am
               JOIN ${TABLES.activities} a ON a.id = am.activity_id
               WHERE a.entity_type = ? AND a.entity_id = ?)
             OR u.id IN (SELECT author_id FROM ${TABLES.notes} WHERE entity_type = ? AND entity_id = ?)
             OR u.id IN (SELECT actor_id FROM ${TABLES.events} WHERE entity_type = ? AND entity_id = ?)
           )
           ORDER BY u.name ASC`
        )
        .all(ownerUserId ?? "", type, id, type, id, type, id, type, id, type, id) as
        { id: string; name: string; email: string; roles: string }[],
    []
  );

  for (const row of userRows) {
    const node: GraphNode = {
      id: row.id,
      type: "user",
      label: row.name ?? row.id,
      sublabel: "Employee",
      color: NODE_TYPE_CONFIG.user.color,
      metadata: { email: row.email, roles: row.roles },
    };
    addNode(node, "users");
  }

  const taskRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT id, title, due_at, assignee_id, completed_at
           FROM ${TABLES.tasks}
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY id ASC
           LIMIT 20`
        )
        .all(type, id) as { id: string; title: string; due_at: string | null; assignee_id: string | null; completed_at: string | null }[],
    []
  );

  for (const row of taskRows) {
    const node: GraphNode = {
      id: row.id,
      type: "task",
      label: row.title ?? row.id,
      sublabel: row.completed_at ? "Completed" : "Task",
      color: NODE_TYPE_CONFIG.task.color,
      metadata: { due_at: row.due_at, assignee_id: row.assignee_id },
    };
    addNode(node, "tasks");
  }

  const activityRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT id, body, occurred_at, direction, activity_type_id, user_id
           FROM ${TABLES.activities}
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY id ASC
           LIMIT 20`
        )
        .all(type, id) as { id: string; body: string; occurred_at: string | null; direction: string | null; activity_type_id: string | null; user_id: string | null }[],
    []
  );

  for (const row of activityRows) {
    const node: GraphNode = {
      id: row.id,
      type: "activity",
      label: (row.body ?? "").slice(0, 40) || row.id,
      sublabel: row.direction ?? "Activity",
      color: NODE_TYPE_CONFIG.activity.color,
      metadata: { occurred_at: row.occurred_at, activity_type_id: row.activity_type_id, user_id: row.user_id },
    };
    addNode(node, "activities");
  }

  const eventRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT id, event_type, timestamp, actor_id
           FROM ${TABLES.events}
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY id ASC
           LIMIT 20`
        )
        .all(type, id) as { id: string; event_type: string; timestamp: string | null; actor_id: string | null }[],
    []
  );

  for (const row of eventRows) {
    const node: GraphNode = {
      id: row.id,
      type: "event",
      label: row.event_type.replace(/_/g, " "),
      sublabel: "Action",
      color: NODE_TYPE_CONFIG.event.color,
      metadata: { timestamp: row.timestamp, actor_id: row.actor_id },
    };
    addNode(node, "actions");
  }

  if (type === "customer" || type === "lead" || type === "deal") {
    if (type === "customer") {
      const leadRows = safeGet(
        () =>
          db
            .prepare(
              `SELECT id, full_name, stage_id, primary_source_id
               FROM ${TABLES.leads}
               WHERE establishment_id = ? AND deleted_at IS NULL AND merged_into_id IS NULL
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(id) as { id: string; full_name: string | null; stage_id: string | null; primary_source_id: string | null }[],
        []
      );
      for (const row of leadRows) {
        const node: GraphNode = {
          id: row.id,
          type: "lead",
          label: row.full_name ?? row.id,
          sublabel: "Lead",
          color: NODE_TYPE_CONFIG.lead.color,
          metadata: { stage_id: row.stage_id, primary_source_id: row.primary_source_id },
        };
        addNode(node, "leads");
      }

      const dealRows = safeGet(
        () =>
          db
            .prepare(
              `SELECT id, name, stage_id
               FROM ${TABLES.deals}
               WHERE establishment_id = ? AND deleted_at IS NULL
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(id) as { id: string; name: string | null; stage_id: string | null }[],
        []
      );
      for (const row of dealRows) {
        const node: GraphNode = {
          id: row.id,
          type: "deal",
          label: row.name ?? row.id,
          sublabel: "Deal",
          color: NODE_TYPE_CONFIG.deal.color,
          metadata: { stage_id: row.stage_id },
        };
        addNode(node, "related");
      }

      const customerTaskRows = safeGet(
        () =>
          db
            .prepare(
              `SELECT id, title, due_at, assignee_id, completed_at
               FROM ${TABLES.tasks}
               WHERE entity_type IN ('establishment', 'company') AND entity_id = ?
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(id) as { id: string; title: string; due_at: string | null; assignee_id: string | null; completed_at: string | null }[],
        []
      );
      for (const row of customerTaskRows) {
        const node: GraphNode = {
          id: row.id,
          type: "task",
          label: row.title ?? row.id,
          sublabel: row.completed_at ? "Completed" : "Task",
          color: NODE_TYPE_CONFIG.task.color,
          metadata: { due_at: row.due_at, assignee_id: row.assignee_id },
        };
        addNode(node, "tasks");
      }
    } else if (type === "lead") {
      const customerRow = safeGet(
        () =>
          db
            .prepare(`SELECT establishment_id FROM ${TABLES.leads} WHERE id = ? AND establishment_id IS NOT NULL LIMIT 1`)
            .get(id) as { establishment_id: string } | undefined,
        undefined
      );
      if (customerRow?.establishment_id) {
        const customerNode = resolveNode("customer", customerRow.establishment_id);
        if (customerNode) addNode(customerNode, "related");
      }

      const relatedLeads = safeGet(
        () =>
          db
            .prepare(
              `SELECT id, full_name, stage_id, primary_source_id
               FROM ${TABLES.leads}
               WHERE establishment_id = ? AND deleted_at IS NULL AND merged_into_id IS NULL AND id != ?
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(customerRow?.establishment_id ?? "", id) as { id: string; full_name: string | null; stage_id: string | null; primary_source_id: string | null }[],
        []
      );
      for (const row of relatedLeads) {
        const node: GraphNode = {
          id: row.id,
          type: "lead",
          label: row.full_name ?? row.id,
          sublabel: "Lead",
          color: NODE_TYPE_CONFIG.lead.color,
          metadata: { stage_id: row.stage_id, primary_source_id: row.primary_source_id },
        };
        addNode(node, "leads");
      }

      const dealRows = safeGet(
        () =>
          db
            .prepare(
              `SELECT id, name, stage_id
               FROM ${TABLES.deals}
               WHERE lead_id = ? AND deleted_at IS NULL
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(id) as { id: string; name: string | null; stage_id: string | null }[],
        []
      );
      for (const row of dealRows) {
        const node: GraphNode = {
          id: row.id,
          type: "deal",
          label: row.name ?? row.id,
          sublabel: "Deal",
          color: NODE_TYPE_CONFIG.deal.color,
          metadata: { stage_id: row.stage_id },
        };
        addNode(node, "related");
      }
    } else if (type === "deal") {
      const leadRow = safeGet(
        () =>
          db
            .prepare(`SELECT lead_id, establishment_id FROM ${TABLES.deals} WHERE id = ? LIMIT 1`)
            .get(id) as { lead_id: string | null; establishment_id: string | null } | undefined,
        undefined
      );
      if (leadRow?.lead_id) {
        const leadNode = resolveNode("lead", leadRow.lead_id);
        if (leadNode) addNode(leadNode, "leads");
      }
      if (leadRow?.establishment_id) {
        const customerNode = resolveNode("customer", leadRow.establishment_id);
        if (customerNode) addNode(customerNode, "related");
      }
    }

    const contactEstId = safeGet<string | null>(() => {
      if (type === "customer") return id;
      if (type === "lead") {
        const r = db.prepare(`SELECT establishment_id FROM ${TABLES.leads} WHERE id = ?`).get(id) as
          { establishment_id?: string } | undefined;
        return r?.establishment_id ?? null;
      }
      if (type === "deal") {
        const r = db.prepare(`SELECT establishment_id FROM ${TABLES.deals} WHERE id = ?`).get(id) as
          { establishment_id?: string } | undefined;
        return r?.establishment_id ?? null;
      }
      return null;
    }, null);

    const contactRows = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, full_name, role, phone, email
             FROM ${TABLES.contacts}
             WHERE establishment_id = ? AND deleted_at IS NULL
             ORDER BY id ASC
             LIMIT 20`
          )
          .all(contactEstId ?? "") as
          { id: string; full_name: string; role: string | null; phone: string | null; email: string | null }[],
      []
    );

    for (const row of contactRows) {
      const node: GraphNode = {
        id: row.id,
        type: "contact",
        label: row.full_name ?? row.id,
        sublabel: row.role ?? "Contact",
        color: NODE_TYPE_CONFIG.contact.color,
        metadata: { phone: row.phone, email: row.email },
      };
      addNode(node, "related");
    }

    const noteRows = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, body
             FROM ${TABLES.notes}
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY id ASC
             LIMIT 20`
          )
          .all(type, id) as { id: string; body: string | null }[],
      []
    );

    for (const row of noteRows) {
      const node: GraphNode = {
        id: row.id,
        type: "note",
        label: (row.body ?? "").slice(0, 40) || row.id,
        sublabel: "Note",
        color: NODE_TYPE_CONFIG.note.color,
      };
      addNode(node, "related");
    }
  }

  return {
    root,
    categories: {
      owner: { count: Math.min(ownerNodes.length, MAX_VISIBLE_CHILDREN), totalCount: ownerNodes.length, nodes: ownerNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      users: { count: Math.min(userNodes.length, MAX_VISIBLE_CHILDREN), totalCount: userNodes.length, nodes: userNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      tasks: { count: Math.min(taskNodes.length, MAX_VISIBLE_CHILDREN), totalCount: taskNodes.length, nodes: taskNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      activities: { count: Math.min(activityNodes.length, MAX_VISIBLE_CHILDREN), totalCount: activityNodes.length, nodes: activityNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      actions: { count: Math.min(actionNodes.length, MAX_VISIBLE_CHILDREN), totalCount: actionNodes.length, nodes: actionNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      related: { count: Math.min(relatedNodes.length, MAX_VISIBLE_CHILDREN), totalCount: relatedNodes.length, nodes: relatedNodes.slice(0, MAX_VISIBLE_CHILDREN) },
      leads: { count: Math.min(leadsNodes.length, MAX_VISIBLE_CHILDREN), totalCount: leadsNodes.length, nodes: leadsNodes.slice(0, MAX_VISIBLE_CHILDREN) },
    },
  };
}

export function getGraphRecordsList(
  category: string,
  page: number,
  pageSize: number,
  search?: string,
  stageId?: string,
  sourceId?: string,
  ownerId?: string
): {
  records: Array<{
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const db = getDb();
  const results: Array<{
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  }> = [];

  const term = search?.trim() ? `%${search.trim()}%` : null;

  if (category === "leads") {
    const where = ["l.deleted_at IS NULL", "l.merged_into_id IS NULL"];
    const queryParams: unknown[] = [];

    if (term) {
      where.push(
        `(l.full_name LIKE ? OR COALESCE(e.name, '') LIKE ? OR COALESCE(l.normalized_email, '') LIKE ? OR COALESCE(l.normalized_phone, '') LIKE ?)`
      );
      queryParams.push(term, term, term, term);
    }
    if (stageId) {
      where.push("l.stage_id = ?");
      queryParams.push(stageId);
    }
    if (sourceId) {
      where.push("l.primary_source_id = ?");
      queryParams.push(sourceId);
    }
    if (ownerId) {
      where.push("l.owner_id = ?");
      queryParams.push(ownerId);
    }

    const whereSql = "WHERE " + where.join(" AND ");

    const countRow = safeGet(
      () =>
        db
          .prepare(
            `SELECT COUNT(DISTINCT l.id) as cnt FROM ${TABLES.leads} l LEFT JOIN ${TABLES.customers} e ON e.id = l.establishment_id ${whereSql}`
          )
          .get(...queryParams) as { cnt: number },
      { cnt: 0 }
    );

    const rows = safeGet(
      () =>
        db
          .prepare(
            `WITH deduped_leads AS (
              SELECT id, MAX(full_name) AS full_name, MAX(establishment_id) AS establishment_id, MAX(created_at) AS created_at
              FROM ${TABLES.leads}
              WHERE deleted_at IS NULL AND merged_into_id IS NULL
              GROUP BY id
            ),
            deduped_establishments AS (
              SELECT id, MAX(name) AS name FROM ${TABLES.customers} GROUP BY id
            )
            SELECT dl.id, dl.full_name, COALESCE(e.name, '') AS company_name
            FROM deduped_leads dl
            LEFT JOIN deduped_establishments e ON e.id = dl.establishment_id
            ${whereSql.replace(/l\./g, "dl.").replace(/e\./g, "e.")}
            ORDER BY dl.created_at DESC, dl.id ASC
            LIMIT ? OFFSET ?`
          )
          .all(...queryParams, pageSize, (page - 1) * pageSize) as Array<{ id: string; full_name: string; company_name: string | null }>,
      []
    );

    for (const row of rows) {
      results.push({
        entityType: "lead",
        entityId: row.id,
        displayName: row.full_name,
        secondaryText: row.company_name || undefined,
      });
    }

    const total = countRow.cnt;
    return { records: results, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  if (category === "deals") {
    const searchWhere =
      term &&
      ` AND (d.name LIKE ? OR COALESCE(ec.name, '') LIKE ? OR COALESCE(l.full_name, '') LIKE ?)`;

    const countRow = safeGet(
      () =>
        db
          .prepare(
            `SELECT COUNT(DISTINCT d.id) as cnt FROM ${TABLES.deals} d LEFT JOIN ${TABLES.customers} ec ON ec.id = d.establishment_id LEFT JOIN ${TABLES.leads} l ON l.id = d.lead_id WHERE d.deleted_at IS NULL${searchWhere ?? ""}`
          )
          .get(...(term ? [term, term, term] : [])) as { cnt: number },
      { cnt: 0 }
    );

    const rows = safeGet(
      () =>
        db
          .prepare(
            `WITH deduped_deals AS (
              SELECT id, MAX(name) AS name, MAX(establishment_id) AS establishment_id, MAX(stage_id) AS stage_id, MAX(lead_id) AS lead_id, MAX(created_at) AS created_at
              FROM ${TABLES.deals}
              WHERE deleted_at IS NULL
              GROUP BY id
            ),
            deduped_establishments AS (
              SELECT id, MAX(name) AS name FROM ${TABLES.customers} GROUP BY id
            ),
            deduped_stages AS (
              SELECT id, MAX(label) AS label FROM ${TABLES.stages} GROUP BY id
            ),
            deduped_leads AS (
              SELECT id, MAX(full_name) AS full_name FROM ${TABLES.leads} GROUP BY id
            )
            SELECT dd.id, dd.name, COALESCE(e.name, '') AS company_name, COALESCE(ps.label, '') AS stage_label
            FROM deduped_deals dd
            LEFT JOIN deduped_establishments e ON e.id = dd.establishment_id
            LEFT JOIN deduped_stages ps ON ps.id = dd.stage_id
            LEFT JOIN deduped_leads l ON l.id = dd.lead_id
            WHERE 1=1${searchWhere ? ` AND (dd.name LIKE ? OR COALESCE(e.name, '') LIKE ? OR COALESCE(l.full_name, '') LIKE ?)` : ""}
            ORDER BY dd.created_at DESC, dd.id ASC
            LIMIT ? OFFSET ?`
          )
          .all(...(term ? [term, term, term] : []), pageSize, (page - 1) * pageSize) as Array<{ id: string; name: string; company_name: string | null; stage_label: string | null }>,
      []
    );

    for (const row of rows) {
      const parts = [row.company_name, row.stage_label].filter(Boolean);
      results.push({
        entityType: "deal",
        entityId: row.id,
        displayName: row.name,
        secondaryText: parts.length > 0 ? parts.join(" · ") : undefined,
      });
    }

    const total = countRow.cnt;
    return { records: results, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  return { records: [], total: 0, page: 1, pageSize, totalPages: 1 };
}

export function getAllLeadsForGraph(): Array<{ id: string; full_name: string; company_name: string | null }> {
  const db = getDb();

  const rows = safeGet(
    () =>
      db
        .prepare(
          `WITH deduped_leads AS (
            SELECT id, MAX(full_name) AS full_name, MAX(establishment_id) AS establishment_id, MAX(created_at) AS created_at
            FROM ${TABLES.leads}
            WHERE deleted_at IS NULL AND merged_into_id IS NULL
            GROUP BY id
          ),
          deduped_establishments AS (
            SELECT id, MAX(name) AS name FROM ${TABLES.customers} GROUP BY id
          )
          SELECT dl.id, dl.full_name, COALESCE(e.name, '') AS company_name
          FROM deduped_leads dl
          LEFT JOIN deduped_establishments e ON e.id = dl.establishment_id
          ORDER BY dl.created_at DESC, dl.id ASC`
        )
        .all() as Array<{ id: string; full_name: string; company_name: string | null }>,
    []
  );

  return rows;
}

/* ------------------------------------------------------------------ */
/* Lead aggregates for progressive discovery                           */
/* ------------------------------------------------------------------ */

export interface LeadAggregates {
  totalLeads: number;
  stages: Array<{ id: string; label: string; color: string; count: number }>;
  sources: Array<{ id: string; label: string; color: string; count: number }>;
  owners: Array<{ id: string; name: string; count: number }>;
}

export function getLeadAggregates(): LeadAggregates {
  const db = getDb();

  const totalRow = safeGet(
    () => db.prepare(`SELECT COUNT(DISTINCT l.id) as cnt FROM ${TABLES.leads} l WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL`).get() as { cnt: number },
    { cnt: 0 }
  );

  const stageRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT ps.id, ps.label, ps.color, COUNT(DISTINCT l.id) as count
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.stages} ps ON ps.id = l.stage_id
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
           GROUP BY ps.id, ps.label, ps.color
           ORDER BY ps.sort_order ASC, ps.label ASC`
        )
        .all() as Array<{ id: string; label: string; color: string; count: number }>,
    []
  );

  const sourceRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT s.id, s.label, s.color, COUNT(DISTINCT l.id) as count
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.sources} s ON s.id = l.primary_source_id
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL
           GROUP BY s.id, s.label, s.color
           ORDER BY s.sort_order ASC, s.label ASC`
        )
        .all() as Array<{ id: string; label: string; color: string; count: number }>,
    []
  );

  const ownerRows = safeGet(
    () =>
      db
        .prepare(
          `SELECT u.id, u.name, COUNT(DISTINCT l.id) as count
           FROM ${TABLES.leads} l
           LEFT JOIN ${TABLES.users} u ON u.id = l.owner_id
           WHERE l.deleted_at IS NULL AND l.merged_into_id IS NULL AND l.owner_id IS NOT NULL
           GROUP BY u.id, u.name
           ORDER BY u.name ASC`
        )
        .all() as Array<{ id: string; name: string; count: number }>,
    []
  );

  return {
    totalLeads: totalRow.cnt,
    stages: stageRows,
    sources: sourceRows,
    owners: ownerRows,
  };
}

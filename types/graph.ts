export type EntityType =
  | "customer"
  | "lead"
  | "deal"
  | "task"
  | "activity"
  | "user"
  | "contact"
  | "memory"
  | "note"
  | "source"
  | "stage"
  | "industry"
  | "event"
  | "task_type"
  | "activity_type"
  | "lost_reason";

export type MemoryType = "decision" | "context" | "lesson" | "note";

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  sublabel?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  label?: string;
}

export interface GraphSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphMemory {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  memory_type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  source?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FixedGraphData {
  root: GraphNode;
  categories: {
    owner: { count: number; totalCount: number; nodes: GraphNode[] };
    users: { count: number; totalCount: number; nodes: GraphNode[] };
    tasks: { count: number; totalCount: number; nodes: GraphNode[] };
    activities: { count: number; totalCount: number; nodes: GraphNode[] };
    actions: { count: number; totalCount: number; nodes: GraphNode[] };
    related: { count: number; totalCount: number; nodes: GraphNode[] };
    leads: { count: number; totalCount: number; nodes: GraphNode[] };
  };
}

export interface CreateMemoryInput {
  entity_type: EntityType;
  entity_id: string;
  memory_type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  source?: string;
  created_by?: string;
}

export interface UpdateMemoryInput {
  memory_type?: MemoryType;
  content?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

export interface GraphSearchResult {
  id: string;
  type: EntityType;
  label: string;
  sublabel?: string;
  isAiCopy?: boolean;
  secondaryText?: string;
}

export const NODE_TYPE_CONFIG: Record<EntityType, { label: string; color: string; table: string }> = {
  customer: { label: "Customer", color: "#2563eb", table: "establishments" },
  lead: { label: "Lead", color: "#06b6d4", table: "leads" },
  deal: { label: "Deal", color: "#7c3aed", table: "deals" },
  task: { label: "Task", color: "#d97706", table: "tasks" },
  activity: { label: "Activity", color: "#db2777", table: "activities" },
  user: { label: "Employee", color: "#8b5cf6", table: "users" },
  contact: { label: "Contact", color: "#0891b2", table: "contacts" },
  memory: { label: "Memory", color: "#dc2626", table: "knowledge_graph_memories" },
  note: { label: "Note", color: "#6b7280", table: "notes" },
  source: { label: "Source", color: "#059669", table: "sources" },
  stage: { label: "Stage", color: "#7c3aed", table: "pipeline_stages" },
  industry: { label: "Industry", color: "#0891b2", table: "industries" },
  event: { label: "Action", color: "#059669", table: "crm_events" },
  task_type: { label: "Task Type", color: "#d97706", table: "task_types" },
  activity_type: { label: "Activity Type", color: "#db2777", table: "activity_types" },
  lost_reason: { label: "Lost Reason", color: "#dc2626", table: "lost_reasons" },
};

export const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  owner:      { label: "Owner",      color: "#8b5cf6", icon: "user" },
  leads:      { label: "Leads",      color: "#06b6d4", icon: "users" },
  users:      { label: "Users",      color: "#6366f1", icon: "users" },
  tasks:      { label: "Tasks",      color: "#d97706", icon: "check-square" },
  activities: { label: "Activities", color: "#db2777", icon: "phone" },
  actions:    { label: "Actions",    color: "#059669", icon: "zap" },
  related:    { label: "Related",    color: "#6b7280", icon: "link" },
};

export interface GraphRecordItem {
  entityType: string;
  entityId: string;
  displayName: string;
  secondaryText?: string;
}

export interface RecordsListResponse {
  records: GraphRecordItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadAggregates {
  totalLeads: number;
  stages: Array<{ id: string; label: string; color: string; count: number }>;
  sources: Array<{ id: string; label: string; color: string; count: number }>;
  owners: Array<{ id: string; name: string; count: number }>;
}

export const MEMORY_TYPE_CONFIG: Record<MemoryType, { label: string; color: string }> = {
  decision: { label: "Decision", color: "#dc2626" },
  context: { label: "Context", color: "#2563eb" },
  lesson: { label: "Lesson", color: "#059669" },
  note: { label: "Note", color: "#6b7280" },
};

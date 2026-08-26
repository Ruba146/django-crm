export interface CustomerPackage {
  customer: import("@/types").CustomerDetail;
  profile: {
    id: string;
    name: string | null;
    industry: { label: string | null; color: string | null } | null;
    source: { label: string | null; color: string | null } | null;
    status: { label: string | null; color: string | null } | null;
    ownerName: string | null;
    city: string | null;
    created_at: string | null;
  };
  contacts: import("@/types").Contact[];
  leads: import("@/types").Lead[];
  deals: import("@/types").CustomerDeal[];
  activities: import("@/types").CustomerActivity[];
  tasks: import("@/types").CustomerTask[];
  notes: string | null;
  relationship_graph: import("@/types/graph").GraphSubgraph;
  event_history: import("@/types/events").CrmEvent[];
  memories: import("@/types/graph").GraphMemory[];
  decisions: import("@/types/decision").DecisionAnalysis;
  causal_insights: import("@/types/causal").CausalAnalysis;
  active_processes: import("@/types/process").ProcessInstance[];
  summary: string;
  generated_at: string;
}

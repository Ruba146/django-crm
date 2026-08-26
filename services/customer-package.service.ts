import {
  getCustomerActivities,
  getCustomerDeals,
  getCustomerDetail,
  getCustomerLeads,
  getCustomerStatistics,
  getCustomerTasks,
} from "@/services/customer.service";
import { analyzeCausality } from "@/services/causal.service";
import { evaluateDecisions } from "@/services/decision.service";
import { getEntityEvents } from "@/services/event.service";
import { getMemories, getSubgraph } from "@/services/graph.service";
import { getProcessInstances } from "@/services/process.service";
import type { CustomerPackage } from "@/types/customer-package";

export function getCustomerPackage(customerId: string): CustomerPackage | null {
  const detail = getCustomerDetail(customerId);
  if (!detail) return null;

  const leads = getCustomerLeads(customerId);
  const deals = getCustomerDeals(customerId);
  const activities = getCustomerActivities(customerId, 50);
  const tasks = getCustomerTasks(customerId, 50);
  const statistics = getCustomerStatistics(customerId);
  const relationship_graph = getSubgraph("customer", customerId, 2);

  const leadIds = leads.map((l) => l.id).filter((id): id is string => id !== null);
  const dealIds = deals.map((d) => d.id).filter((id): id is string => id !== null);

  const event_history = gatherEvents(customerId, leadIds, dealIds);
  const memories = gatherMemories(customerId, leadIds, dealIds);

  const decisions = evaluateDecisions({ entityType: "customer", entityId: customerId });
  const causal_insights = analyzeCausality({ entityType: "customer", entityId: customerId });

  const active_processes = [
    ...getProcessInstances({ entityType: "customer", entityId: customerId, status: "running" }),
    ...getProcessInstances({ entityType: "customer", entityId: customerId, status: "waiting" }),
  ];

  const profile = {
    id: detail.id,
    name: detail.name,
    industry: detail.industry,
    source: detail.source,
    status: detail.status,
    ownerName: detail.ownerName,
    city: detail.city,
    created_at: detail.created_at,
  };

  const summary = `${detail.name ?? "Customer"}: ${statistics?.dealsCount ?? 0} deals, ${statistics?.activitiesCount ?? 0} activities, ${statistics?.tasksCount ?? 0} tasks. ${decisions.results.length} decision alerts, ${causal_insights.chains.length} causal insights.`;

  return {
    customer: detail,
    profile,
    contacts: detail.contacts,
    leads,
    deals,
    activities,
    tasks,
    notes: detail.notes,
    relationship_graph,
    event_history,
    memories,
    decisions,
    causal_insights,
    active_processes,
    summary,
    generated_at: new Date().toISOString(),
  };
}

function gatherEvents(customerId: string, leadIds: string[], dealIds: string[]): import("@/types/events").CrmEvent[] {
  const events: import("@/types/events").CrmEvent[] = [];
  const push = (entityType: string, entityId: string) => {
    const evts = getEntityEvents(entityType as import("@/types/events").EntityType, entityId, 100);
    events.push(...evts);
  };

  push("customer", customerId);
  for (const lid of leadIds) push("lead", lid);
  for (const did of dealIds) push("deal", did);

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return events;
}

function gatherMemories(customerId: string, leadIds: string[], dealIds: string[]): import("@/types/graph").GraphMemory[] {
  const memories: import("@/types/graph").GraphMemory[] = [];
  const push = (entityType: string, entityId: string) => {
    const mems = getMemories(entityType as import("@/types/graph").EntityType, entityId);
    memories.push(...mems);
  };

  push("customer", customerId);
  for (const lid of leadIds) push("lead", lid);
  for (const did of dealIds) push("deal", did);

  memories.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return memories;
}

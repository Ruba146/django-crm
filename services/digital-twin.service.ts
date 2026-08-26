import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { getSubgraph, resolveNode, searchAllEntities } from "@/services/graph.service";
import { getEntityEvents } from "@/services/event.service";
import { analyzeCausality } from "@/services/causal.service";
import { evaluateDecisions } from "@/services/decision.service";
import { getProcessInstances, getProcessDefinition, getProcessInstance } from "@/services/process.service";
import { getRelationshipIntelligence } from "@/services/relationship-intelligence.service";
import type {
  DigitalTwinSnapshot,
  DigitalTwinQueryInput,
  DigitalTwinProcess,
  DigitalTwinImpactMap,
  DigitalTwinBottleneck,
  DigitalTwinSearchResultItem,
  DigitalTwinSearchGroup,
  DigitalTwinSearchResponse,
} from "@/types/digital-twin";
import type { EntityType as GraphEntityType, GraphNode, GraphEdge } from "@/types/graph";
import type { CrmEvent } from "@/types/events";
import type { CausalAnalysis } from "@/types/causal";
import type { DecisionAnalysis } from "@/types/decision";
import type { ProcessInstance } from "@/types/process";
import type { RelationshipIntelligence } from "@/types/relationship-intelligence";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function now(): string {
  return new Date().toISOString();
}

function safeGet<T>(query: () => T, fallback: T): T {
  try {
    return query();
  } catch {
    return fallback;
  }
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toGraphEntityType(entityType: string): GraphEntityType {
  return entityType as GraphEntityType;
}

/* ------------------------------------------------------------------ */
/* Entity state resolution                                             */
/* ------------------------------------------------------------------ */

interface EntityStateRow {
  [key: string]: unknown;
}

function getEntityState(entityType: string, entityId: string): EntityStateRow {
  const db = getDb();

  if (entityType === "customer") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, name, city, commercial_registration_number, created_at, updated_at
             FROM ${TABLES.customers} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "lead") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, full_name, normalized_phone, normalized_email, company, stage_id, source_id, owner_id, establishment_id, created_at, updated_at
             FROM ${TABLES.leads} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "deal") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, name, lead_id, establishment_id, stage_id, owner_id, expected_value_minor, currency_code, probability_pct, target_close_date, actual_close_date, contract_length_months, created_at, updated_at
             FROM ${TABLES.deals} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "task") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, title, description, entity_type, entity_id, assignee_id, due_at, completed_at, created_at, updated_at
             FROM ${TABLES.tasks} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "activity") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, body, direction, entity_type, entity_id, user_id, occurred_at, created_at, updated_at
             FROM ${TABLES.activities} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "user") {
    const row = safeGet(
      () =>
        db
          .prepare(`SELECT id, name, email, role, created_at, updated_at FROM ${TABLES.users} WHERE id = ? LIMIT 1`)
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "contact") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, full_name, email, phone, role, establishment_id, created_at, updated_at
             FROM ${TABLES.contacts} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "note") {
    const row = safeGet(
      () =>
        db
          .prepare(
            `SELECT id, body, entity_type, entity_id, created_at, updated_at
             FROM ${TABLES.notes} WHERE id = ? LIMIT 1`
          )
          .get(entityId) as EntityStateRow | undefined,
      {}
    );
    return row ?? {};
  }

  if (entityType === "process") {
    const instance = safeGet(() => getProcessInstance(entityId), null);
    if (!instance) return {};
    const def = safeGet(() => getProcessDefinition(instance.definitionId), null);
    return {
      id: instance.id,
      definitionId: instance.definitionId,
      definitionName: def?.name,
      status: instance.status,
      currentNodeId: instance.currentNodeId,
      entityType: instance.entityType,
      entityId: instance.entityId,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
    };
  }

  return {};
}

function getEntityLabel(entityType: string, entityId: string): string {
  if (entityType === "process") {
    const instance = safeGet(() => getProcessInstance(entityId), null);
    if (instance) {
      const defName = safeGet(() => getProcessDefinition(instance.definitionId)?.name, instance.definitionId);
      return `${defName} (${instance.entityType}:${instance.entityId})`;
    }
    return entityId;
  }
  const node = resolveNode(entityType as GraphEntityType, entityId);
  return node?.label ?? entityId;
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

function mapGraphNode(node: GraphNode): DigitalTwinSnapshot["entities"][number] {
  return {
    id: node.id,
    type: node.type as DigitalTwinSnapshot["focus_entity"]["entity_type"],
    label: node.label,
    sublabel: node.sublabel,
    color: node.color,
    metadata: node.metadata,
  };
}

function mapGraphEdge(edge: GraphEdge): DigitalTwinSnapshot["relationships"][number] {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationship: edge.relationship,
    label: edge.label,
  };
}

function mapEvent(event: CrmEvent): DigitalTwinSnapshot["recent_events"][number] {
  return {
    id: event.id,
    event_type: event.event_type,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    actor_id: event.actor_id,
    timestamp: event.timestamp,
    metadata: event.metadata,
    previous_state: event.previous_state,
    new_state: event.new_state,
    source: event.source,
  };
}

function mapProcess(instance: ProcessInstance): DigitalTwinSnapshot["processes"][number] {
  const definitionName = safeGet(() => {
    const def = getProcessDefinition(instance.definitionId);
    return def?.name ?? "";
  }, "");
  return {
    id: instance.id,
    definitionId: instance.definitionId,
    definitionName,
    status: instance.status,
    currentNodeId: instance.currentNodeId,
    startedAt: instance.startedAt,
    completedAt: instance.completedAt,
  };
}

function mapDecision(result: DecisionAnalysis["results"][number]): DigitalTwinSnapshot["decisions"][number] {
  return {
    ruleId: result.ruleId,
    ruleName: result.ruleName,
    severity: result.severity,
    priority: result.priority,
    triggered: result.triggered,
    description: result.description,
    recommendedAction: result.recommendedAction,
    evidence: result.evidence,
  };
}

function mapCausalChain(chain: CausalAnalysis["chains"][number]): DigitalTwinSnapshot["dependencies"][number] {
  return {
    id: chain.id,
    rootCause: chain.rootCause,
    confidence: chain.confidence,
    description: chain.explanation,
    explanation: chain.explanation,
  };
}

function mapImpactMap(ri: RelationshipIntelligence): DigitalTwinSnapshot["impact_map"] {
  return {
    entityId: ri.entityId,
    entityName: ri.entityName,
    overallStrength: ri.overallStrength,
    relationships: ri.relationships.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      role: r.role,
      strength: r.strength,
      factors: r.factors,
    })),
    weakPoints: ri.weakPoints,
    missingRelationships: ri.missingRelationships,
  };
}

/* ------------------------------------------------------------------ */
/* Bottleneck and concentration derivation                             */
/* ------------------------------------------------------------------ */

function deriveBottlenecks(
  decisions: DigitalTwinSnapshot["decisions"],
  processes: DigitalTwinProcess[],
  impactMap: DigitalTwinImpactMap | null,
  causalContext: CausalAnalysis | null
): DigitalTwinSnapshot["bottlenecks"] {
  const bottlenecks: DigitalTwinSnapshot["bottlenecks"] = [];

  for (const decision of decisions) {
    if (!decision.triggered) continue;
    const type = decision.ruleId === "owner_overloaded" ? "owner" :
      decision.ruleId === "stage_stagnation" ? "stage" :
      decision.ruleId === "value_decline" ? "value" :
      decision.ruleId === "missing_owner" ? "relationship" :
      decision.ruleId === "inactive_customer" || decision.ruleId === "follow_up_overdue" ? "relationship" :
      decision.ruleId === "task_overdue" ? "process" :
      "process";

    bottlenecks.push({
      type: type as DigitalTwinSnapshot["bottlenecks"][number]["type"],
      label: decision.ruleName,
      description: decision.description,
      severity: decision.severity as DigitalTwinSnapshot["bottlenecks"][number]["severity"],
      source: "decision_engine",
    });
  }

  const waitingProcesses = processes.filter((p) => p.status === "waiting" || p.status === "running");
  if (waitingProcesses.length > 0) {
    bottlenecks.push({
      type: "process",
      label: `${waitingProcesses.length} active process(es)`,
      description: `Processes are in progress and may indicate dependency chains or pending actions.`,
      severity: waitingProcesses.length > 3 ? "warning" : "info",
      source: "process_compiler",
    });
  }

  if (impactMap) {
    for (const wp of impactMap.weakPoints) {
      if (!bottlenecks.some((b) => b.label === wp)) {
        bottlenecks.push({
          type: "relationship",
          label: wp,
          description: wp,
          severity: "warning",
          source: "relationship_intelligence",
        });
      }
    }
  }

  if (causalContext && causalContext.chains.length > 0) {
    const chain = causalContext.chains[0];
    bottlenecks.push({
      type: "process",
      label: chain.rootCause,
      description: chain.explanation,
      severity: chain.confidence === "certain" ? "critical" : chain.confidence === "likely" ? "warning" : "info",
      source: "causal_engine",
    });
  }

  return bottlenecks;
}

function deriveConcentration(
  impactMap: DigitalTwinImpactMap | null,
  processes: DigitalTwinProcess[]
): DigitalTwinSnapshot["concentration"] {
  const concentration: DigitalTwinSnapshot["concentration"] = [];

  if (impactMap) {
    const owners = impactMap.relationships.filter((r) => r.role === "owner");
    const maxOwners = 5;
    concentration.push({
      dimension: "ownership",
      value: owners.length,
      max: maxOwners,
      label: owners.length === 0 ? "No owner assigned" : owners.length === 1 ? "Single owner" : `${owners.length} owners`,
    });

    const strong = impactMap.relationships.filter((r) => r.strength >= 60);
    concentration.push({
      dimension: "strong_relationships",
      value: strong.length,
      max: Math.max(impactMap.relationships.length, 1),
      label: `${strong.length} strong relationship(s)`,
    });

    const totalStrength = impactMap.relationships.reduce((sum, r) => sum + r.strength, 0);
    const maxTotal = impactMap.relationships.length * 100;
    concentration.push({
      dimension: "relationship_strength",
      value: totalStrength,
      max: maxTotal || 1,
      label: `Avg strength: ${impactMap.relationships.length > 0 ? Math.round(totalStrength / impactMap.relationships.length) : 0}/100`,
    });
  }

  const activeProcesses = processes.filter((p) => p.status === "running" || p.status === "waiting").length;
  concentration.push({
    dimension: "active_processes",
    value: activeProcesses,
    max: 10,
    label: `${activeProcesses} active process(es)`,
  });

  return concentration;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function generateDigitalTwin(input: DigitalTwinQueryInput): DigitalTwinSnapshot | null {
  const lookbackDays = input.lookbackDays ?? 90;
  const maxEvents = input.maxEvents ?? 50;
  const maxProcesses = input.maxProcesses ?? 20;
  const maxDecisions = input.maxDecisions ?? 20;
  const maxEntities = input.maxEntities ?? 50;
  const afterDate = daysAgo(lookbackDays);

  const graphEntityType = toGraphEntityType(input.entityType);
  let focusNode: GraphNode | null = null;
  let focusLabel = input.entityId;
  let processInstance: { entityType: string; entityId: string } | null = null;

  if (input.entityType === "process") {
    const instance = safeGet(() => getProcessInstance(input.entityId), null);
    if (!instance) return null;
    processInstance = { entityType: instance.entityType, entityId: instance.entityId };
    const def = safeGet(() => getProcessDefinition(instance.definitionId), null);
    focusLabel = `${def?.name ?? instance.definitionId} (${instance.entityType}:${instance.entityId})`;
    focusNode = {
      id: instance.id,
      type: "memory",
      label: focusLabel,
      sublabel: `Process: ${instance.status}`,
      color: "#7c3aed",
      metadata: { definitionId: instance.definitionId, status: instance.status },
    };
  } else {
    focusNode = resolveNode(graphEntityType, input.entityId);
    if (focusNode) {
      focusLabel = focusNode.label;
    }
  }

  if (!focusNode) return null;

  const focusState = getEntityState(input.entityType, input.entityId);

  let subgraphNodes: GraphNode[] = [];
  let subgraphEdges: GraphEdge[] = [];

  if (input.entityType === "process") {
    const instance = safeGet(() => getProcessInstance(input.entityId), null);
    if (instance) {
      const relatedNode = resolveNode(toGraphEntityType(instance.entityType), instance.entityId);
      if (relatedNode) {
        subgraphNodes.push(relatedNode);
        subgraphEdges.push({
          id: `process:${instance.id}:attached_to:${relatedNode.type}:${relatedNode.id}`,
          source: `process:${instance.id}`,
          target: `${relatedNode.type}:${relatedNode.id}`,
          relationship: "PROCESS_ATTACHED_TO",
          label: "Attached To",
        });
      }
    }
  } else {
    const subgraph = getSubgraph(graphEntityType, input.entityId, 2);
    subgraphNodes = subgraph.nodes;
    subgraphEdges = subgraph.edges;
  }

  const entities = subgraphNodes.slice(0, maxEntities).map(mapGraphNode);
  const relationships = subgraphEdges.map(mapGraphEdge);

  const entityTypeForEvents = input.entityType === "process"
    ? (processInstance?.entityType ?? input.entityType)
    : input.entityType;
  const entityIdForEvents = input.entityType === "process"
    ? (processInstance?.entityId ?? input.entityId)
    : input.entityId;
  const allEvents = getEntityEvents(entityTypeForEvents as import("@/types/events").EntityType, entityIdForEvents, maxEvents);
  const recentEvents = allEvents.filter((e) => e.timestamp >= afterDate).slice(-maxEvents).map(mapEvent);

  const causalEntityType = input.entityType === "process"
    ? (processInstance?.entityType ?? input.entityType)
    : input.entityType;
  const causalEntityId = input.entityType === "process"
    ? (processInstance?.entityId ?? input.entityId)
    : input.entityId;
  const causalContext = analyzeCausality({
    entityType: causalEntityType as "customer" | "lead" | "deal" | "task" | "activity" | "note" | "user",
    entityId: causalEntityId,
    lookbackDays,
  });

  const decisionAnalysis = evaluateDecisions({
    entityType: causalEntityType as "customer" | "lead" | "deal" | "task" | "activity" | "note" | "user",
    entityId: causalEntityId,
  });

  const processInstances = getProcessInstances({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  const activeProcesses = processInstances
    .filter((p) => p.status === "running" || p.status === "waiting")
    .slice(0, maxProcesses)
    .map(mapProcess);

  const impactMap = safeGet(
    () => {
      const ri = getRelationshipIntelligence(
        input.entityType as "customer" | "lead" | "deal",
        input.entityId
      );
      return ri ? mapImpactMap(ri) : null;
    },
    null
  );

  const dependencies = causalContext.chains.slice(0, 10).map(mapCausalChain);
  const decisions = decisionAnalysis.results.slice(0, maxDecisions).map(mapDecision);

  const bottlenecks = deriveBottlenecks(decisions, activeProcesses, impactMap, causalContext);
  const concentration = deriveConcentration(impactMap, activeProcesses);

  return {
    generated_at: now(),
    focus_entity: {
      entity_type: input.entityType,
      entity_id: input.entityId,
      label: focusLabel,
      state: focusState,
    },
    entities,
    relationships,
    dependencies,
    processes: activeProcesses,
    recent_events: recentEvents,
    decisions,
    causal_context: {
      summary: causalContext.summary,
      chains: dependencies,
    },
    impact_map: impactMap,
    bottlenecks,
    concentration,
  };
}

export function getImpactMap(entityType: string, entityId: string): DigitalTwinImpactMap | null {
  const graphEntityType = toGraphEntityType(entityType);
  const focusNode = resolveNode(graphEntityType, entityId);
  if (!focusNode) return null;

  if (entityType === "customer" || entityType === "lead" || entityType === "deal") {
    const ri = getRelationshipIntelligence(entityType as "customer" | "lead" | "deal", entityId);
    if (!ri) return null;
    return mapImpactMap(ri);
  }

  if (entityType === "user") {
    const db = getDb();
    const user = safeGet(
      () => db.prepare(`SELECT id, name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(entityId) as { id: string; name: string | null } | undefined,
      undefined
    );
    if (!user) return null;

    const relationships: DigitalTwinImpactMap["relationships"] = [];

    const ownedDeals = safeGet(
      () => db.prepare(`SELECT id FROM ${TABLES.deals} WHERE owner_id = ? AND deleted_at IS NULL`).all(entityId) as { id: string }[],
      []
    );
    const ownedLeads = safeGet(
      () => db.prepare(`SELECT id FROM ${TABLES.leads} WHERE owner_id = ? AND deleted_at IS NULL`).all(entityId) as { id: string }[],
      []
    );
    const assignedTasks = safeGet(
      () => db.prepare(`SELECT id FROM ${TABLES.tasks} WHERE assignee_id = ? AND completed_at IS NULL`).all(entityId) as { id: string }[],
      []
    );

    const totalItems = ownedDeals.length + ownedLeads.length + assignedTasks.length;
    relationships.push({
      id: entityId,
      type: "user",
      name: user.name,
      role: "owner",
      strength: totalItems > 0 ? Math.min(60 + totalItems * 2, 100) : 20,
      factors: [`Owns ${ownedDeals.length} deals`, `Owns ${ownedLeads.length} leads`, `${assignedTasks.length} open tasks`],
    });

    return {
      entityId,
      entityName: user.name,
      overallStrength: relationships[0]?.strength ?? 0,
      relationships,
      weakPoints: ownedDeals.length === 0 && ownedLeads.length === 0 ? ["No owned records"] : [],
      missingRelationships: [],
    };
  }

  if (entityType === "process") {
    const instance = safeGet(
      () => getProcessInstance(entityId),
      null
    );
    if (!instance) return null;

    const relatedEntityLabel = getEntityLabel(instance.entityType, instance.entityId);
    return {
      entityId: instance.id,
      entityName: `${instance.definitionId} → ${instance.entityType}:${instance.entityId}`,
      overallStrength: instance.status === "running" || instance.status === "waiting" ? 70 : 40,
      relationships: [
        {
          id: instance.entityId,
          type: instance.entityType,
          name: relatedEntityLabel,
          role: "related_entity",
          strength: 80,
          factors: [`Process attached to ${instance.entityType}`],
        },
      ],
      weakPoints: instance.status === "failed" ? ["Process failed"] : instance.status === "waiting" ? ["Process waiting"] : [],
      missingRelationships: [],
    };
  }

  return null;
}

export function getBottlenecks(input: DigitalTwinQueryInput): DigitalTwinBottleneck[] {
  const snapshot = generateDigitalTwin(input);
  if (!snapshot) return [];
  return snapshot.bottlenecks;
}

export function getDigitalTwinForCustomer(customerId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: "customer", entityId: customerId, lookbackDays });
}

export function getDigitalTwinForLead(leadId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: "lead", entityId: leadId, lookbackDays });
}

export function getDigitalTwinForDeal(dealId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: "deal", entityId: dealId, lookbackDays });
}

export function getDigitalTwinForUser(userId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: "user", entityId: userId, lookbackDays });
}

export function getDigitalTwinForProcess(processId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: "process", entityId: processId, lookbackDays });
}

export function getDigitalTwinForEntity(entityType: string, entityId: string, lookbackDays = 90): DigitalTwinSnapshot | null {
  return generateDigitalTwin({ entityType: entityType as DigitalTwinQueryInput["entityType"], entityId, lookbackDays });
}

const ENTITY_TYPE_GROUP_MAP: Record<string, keyof DigitalTwinSearchGroup> = {
  customer: "customers",
  lead: "leads",
  deal: "deals",
  user: "employees",
};

export function searchDigitalTwinEntities(query: string): DigitalTwinSearchResponse {
  const results: DigitalTwinSearchGroup = {
    customers: [],
    leads: [],
    deals: [],
    employees: [],
  };

  const rawResults = searchAllEntities(query);

  for (const item of rawResults) {
    const groupKey = ENTITY_TYPE_GROUP_MAP[item.type];
    if (!groupKey) continue;

    const secondaryText = item.secondary_text ?? undefined;
    const displayName = item.is_ai_copy ? `${item.label} — AI Copy` : item.label;

    results[groupKey].push({
      entityType: item.type as DigitalTwinSearchResultItem["entityType"],
      entityId: item.id,
      displayName,
      isAiCopy: item.is_ai_copy === 1,
      secondaryText,
    });
  }

  return { query: query.trim(), results };
}

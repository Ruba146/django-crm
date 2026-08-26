import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { getEntityEvents } from "@/services/event.service";
import { getNeighbors, resolveNode } from "@/services/graph.service";
import type { CrmEvent, EntityType as EventEntityType, EventType } from "@/types/events";
import type { EntityType as GraphEntityType } from "@/types/graph";
import type {
  CausalAnalysis,
  CausalChain,
  CausalConfidence,
  CausalEvidence,
  CausalLink,
  CausalLinkType,
  CausalQueryInput,
} from "@/types/causal";

const MAX_EVENTS = 200;
const DEFAULT_LOOKBACK_DAYS = 90;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function uuid(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function safeGet<T>(query: () => T, fallback: T): T {
  try {
    return query();
  } catch {
    return fallback;
  }
}

function getUserName(userId: string | null): string | undefined {
  if (!userId) return undefined;
  const db = getDb();
  const row = safeGet(
    () => db.prepare(`SELECT name FROM ${TABLES.users} WHERE id = ? LIMIT 1`).get(userId) as { name: string | null } | undefined,
    undefined
  );
  return row?.name ?? undefined;
}

function getEntityDisplayName(entityType: string, entityId: string): string {
  const node = resolveNode(entityType as GraphEntityType, entityId);
  if (!node || node.label === entityId) return `Unnamed ${entityType}`;
  return node.label;
}

/* ------------------------------------------------------------------ */
/* State-change detection                                              */
/* ------------------------------------------------------------------ */

const STATE_CHANGE_EVENTS: EventType[] = [
  "STAGE_CHANGED",
  "STATUS_CHANGED",
  "OWNER_CHANGED",
  "VALUE_CHANGED",
];

function isStateChangeEvent(event: CrmEvent): boolean {
  return STATE_CHANGE_EVENTS.includes(event.event_type as EventType);
}

function extractStateChange(event: CrmEvent): Record<string, unknown> | undefined {
  const newState = event.new_state as Record<string, unknown> | null;
  const previousState = event.previous_state as Record<string, unknown> | null;
  if (!newState && !previousState) return undefined;
  return { from: previousState, to: newState };
}

/* ------------------------------------------------------------------ */
/* Causal rule evaluators                                              */
/* ------------------------------------------------------------------ */

interface EvaluateContext {
  targetEvent: CrmEvent;
  events: CrmEvent[];
  lookbackDays: number;
}

function evaluateDirectCause(ctx: EvaluateContext): CausalChain | null {
  const stateChange = extractStateChange(ctx.targetEvent);
  if (!stateChange) return null;

  const evidence: CausalEvidence[] = [
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `State changed: ${JSON.stringify(stateChange.from)} → ${JSON.stringify(stateChange.to)}`,
      stateChange,
      actorName: getUserName(ctx.targetEvent.actor_id),
    },
  ];

  const chain: CausalLink[] = [
    {
      linkType: "direct_cause",
      fromEventId: ctx.targetEvent.id,
      fromEventType: ctx.targetEvent.event_type,
      fromTimestamp: ctx.targetEvent.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `The ${ctx.targetEvent.event_type} event directly contains the state transition.`,
    },
  ];

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `Direct state change recorded in ${ctx.targetEvent.event_type} event`,
    confidence: "certain",
    chain,
    evidence,
    explanation: `The entity state changed directly as recorded in event ${ctx.targetEvent.id}. The event itself documents the transition from previous state to new state, making this a certain direct cause.`,
  };
}

function evaluateOwnerEffect(ctx: EvaluateContext): CausalChain | null {
  if (ctx.targetEvent.event_type !== "STAGE_CHANGED" && ctx.targetEvent.event_type !== "STATUS_CHANGED") {
    return null;
  }

  const ownerChangeEvents = ctx.events
    .filter((e) => e.event_type === "OWNER_CHANGED")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const recentOwnerChange = ownerChangeEvents.filter((e) => {
    const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(e.timestamp).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= ctx.lookbackDays;
  });

  if (recentOwnerChange.length === 0) return null;

  const latestOwnerChange = recentOwnerChange[recentOwnerChange.length - 1];
  const newOwnerId = (latestOwnerChange.new_state as Record<string, unknown> | null)?.owner_id as string | undefined;
  const newOwnerName = newOwnerId ? getUserName(newOwnerId) : undefined;

  const activitiesAfterOwnerChange = ctx.events.filter((e) => {
    if (e.event_type !== "ACTIVITY_CREATED") return false;
    const diffMs = new Date(e.timestamp).getTime() - new Date(latestOwnerChange.timestamp).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= ctx.lookbackDays;
  });

  const tasksAfterOwnerChange = ctx.events.filter((e) => {
    if (e.event_type !== "TASK_CREATED" && e.event_type !== "TASK_COMPLETED") return false;
    const diffMs = new Date(e.timestamp).getTime() - new Date(latestOwnerChange.timestamp).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= ctx.lookbackDays;
  });

  const evidence: CausalEvidence[] = [
    {
      eventId: latestOwnerChange.id,
      eventType: latestOwnerChange.event_type,
      timestamp: latestOwnerChange.timestamp,
      description: `Owner changed to ${newOwnerName ?? newOwnerId ?? "unknown"}`,
      stateChange: latestOwnerChange.new_state as Record<string, unknown>,
      actorName: getUserName(latestOwnerChange.actor_id),
    },
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `State changed to ${JSON.stringify(ctx.targetEvent.new_state)}`,
      stateChange: ctx.targetEvent.new_state as Record<string, unknown>,
      actorName: getUserName(ctx.targetEvent.actor_id),
    },
  ];

  for (const act of activitiesAfterOwnerChange.slice(0, 3)) {
    evidence.push({
      eventId: act.id,
      eventType: act.event_type,
      timestamp: act.timestamp,
      description: `Activity created after owner change`,
      actorName: getUserName(act.actor_id),
    });
  }

  const chain: CausalLink[] = [
    {
      linkType: "owner_effect",
      fromEventId: latestOwnerChange.id,
      fromEventType: latestOwnerChange.event_type,
      fromTimestamp: latestOwnerChange.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `Owner changed to ${newOwnerName ?? "new owner"}, followed by ${activitiesAfterOwnerChange.length} activities and ${tasksAfterOwnerChange.length} tasks before the state change.`,
    },
  ];

  const confidence: CausalConfidence = activitiesAfterOwnerChange.length > 0 ? "likely" : "possible";

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `Owner change to ${newOwnerName ?? "new owner"} preceded state change`,
    confidence,
    chain,
    evidence,
    explanation: `The ${ctx.targetEvent.event_type.toLowerCase()} occurred after an owner change event (${latestOwnerChange.id}). ${activitiesAfterOwnerChange.length} activities and ${tasksAfterOwnerChange.length} tasks were recorded after the ownership transfer, suggesting the new owner's actions contributed to the state transition.`,
  };
}

function evaluateDependencyEffect(ctx: EvaluateContext): CausalChain | null {
  const eventEntityType = ctx.targetEvent.entity_type;
  const entityId = ctx.targetEvent.entity_id;

  const graphEntityType = eventEntityType as GraphEntityType;
  const neighbors = getNeighbors(graphEntityType, entityId);
  const relatedEntityTypes = new Set<string>();
  for (const edge of neighbors.edges) {
    const [relType] = edge.target.split(":");
    if (relType) relatedEntityTypes.add(relType);
  }

  let dependencyEvent: CrmEvent | null = null;
  let dependencyLabel = "";

  for (const relType of relatedEntityTypes) {
    const relEvents = getEntityEvents(relType as EventEntityType, entityId, MAX_EVENTS);
    const stateChangeEvents = relEvents.filter((e) => isStateChangeEvent(e) && e.timestamp < ctx.targetEvent.timestamp);

    for (const evt of stateChangeEvents) {
      const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(evt.timestamp).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= ctx.lookbackDays) {
        dependencyEvent = evt;
        dependencyLabel = getEntityDisplayName(relType, entityId);
        break;
      }
    }
    if (dependencyEvent) break;
  }

  if (!dependencyEvent) return null;

  const evidence: CausalEvidence[] = [
    {
      eventId: dependencyEvent.id,
      eventType: dependencyEvent.event_type,
      timestamp: dependencyEvent.timestamp,
      description: `Related entity ${dependencyLabel} experienced ${dependencyEvent.event_type}`,
      stateChange: dependencyEvent.new_state as Record<string, unknown>,
    },
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `Target entity state changed to ${JSON.stringify(ctx.targetEvent.new_state)}`,
      stateChange: ctx.targetEvent.new_state as Record<string, unknown>,
    },
  ];

  const chain: CausalLink[] = [
    {
      linkType: "dependency_effect",
      fromEventId: dependencyEvent.id,
      fromEventType: dependencyEvent.event_type,
      fromTimestamp: dependencyEvent.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `Related entity ${dependencyLabel} changed state before the target entity's state change.`,
    },
  ];

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `State change on related entity ${dependencyLabel}`,
    confidence: "possible",
    chain,
    evidence,
    explanation: `A ${dependencyEvent.event_type.toLowerCase()} event on related entity ${dependencyLabel} occurred before the target state change. The related entity's state transition may have cascaded to the target entity through explicit CRM relationships.`,
  };
}

function evaluateTemporalPattern(ctx: EvaluateContext): CausalChain | null {
  const activityEvents = ctx.events.filter(
    (e) => e.event_type === "ACTIVITY_CREATED" || e.event_type === "TASK_CREATED"
  );

  const inactivityWindow = activityEvents
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .find((e) => {
      const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(e.timestamp).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= ctx.lookbackDays;
    });

  if (!inactivityWindow) return null;

  const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(inactivityWindow.timestamp).getTime();
  const gapDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const evidence: CausalEvidence[] = [
    {
      eventId: inactivityWindow.id,
      eventType: inactivityWindow.event_type,
      timestamp: inactivityWindow.timestamp,
      description: `Last ${inactivityWindow.event_type.toLowerCase()} before state change`,
    },
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `State changed after ${gapDays} days of no recorded activity/tasks`,
      stateChange: ctx.targetEvent.new_state as Record<string, unknown>,
    },
  ];

  const chain: CausalLink[] = [
    {
      linkType: "temporal_pattern",
      fromEventId: inactivityWindow.id,
      fromEventType: inactivityWindow.event_type,
      fromTimestamp: inactivityWindow.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `${gapDays} days elapsed between last activity/task and the state change.`,
    },
  ];

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `Inactivity gap of ${gapDays} days preceded state change`,
    confidence: "possible",
    chain,
    evidence,
    explanation: `There was a ${gapDays}-day gap with no recorded activities or tasks before the ${ctx.targetEvent.event_type.toLowerCase()}. Extended inactivity is a known precursor to stage regression or status changes in CRM workflows.`,
  };
}

function evaluateTaskCompletionEffect(ctx: EvaluateContext): CausalChain | null {
  const taskCompletedEvents = ctx.events
    .filter((e) => e.event_type === "TASK_COMPLETED")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const relevantTask = taskCompletedEvents.find((e) => {
    const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(e.timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 72;
  });

  if (!relevantTask) return null;

  const diffHours = Math.floor(
    (new Date(ctx.targetEvent.timestamp).getTime() - new Date(relevantTask.timestamp).getTime()) / (1000 * 60 * 60)
  );

  const evidence: CausalEvidence[] = [
    {
      eventId: relevantTask.id,
      eventType: relevantTask.event_type,
      timestamp: relevantTask.timestamp,
      description: `Task completed ${diffHours} hours before state change`,
      stateChange: relevantTask.new_state as Record<string, unknown>,
    },
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `State changed to ${JSON.stringify(ctx.targetEvent.new_state)}`,
      stateChange: ctx.targetEvent.new_state as Record<string, unknown>,
    },
  ];

  const chain: CausalLink[] = [
    {
      linkType: "task_completion_effect",
      fromEventId: relevantTask.id,
      fromEventType: relevantTask.event_type,
      fromTimestamp: relevantTask.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `Task completed ${diffHours} hours before the state change event.`,
    },
  ];

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `Task completion ${diffHours} hours prior`,
    confidence: "likely",
    chain,
    evidence,
    explanation: `A task was completed ${diffHours} hours before the ${ctx.targetEvent.event_type.toLowerCase()}. Task completions often trigger downstream state transitions in CRM pipelines when the task was a prerequisite for stage progression.`,
  };
}

function evaluateActivityEffect(ctx: EvaluateContext): CausalChain | null {
  const activityEvents = ctx.events
    .filter((e) => e.event_type === "ACTIVITY_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const relevantActivity = activityEvents.find((e) => {
    const diffMs = new Date(ctx.targetEvent.timestamp).getTime() - new Date(e.timestamp).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 168;
  });

  if (!relevantActivity) return null;

  const outcome = (relevantActivity.metadata as Record<string, unknown> | null)?.outcome as string | undefined;
  const diffHours = Math.floor(
    (new Date(ctx.targetEvent.timestamp).getTime() - new Date(relevantActivity.timestamp).getTime()) / (1000 * 60 * 60)
  );

  const evidence: CausalEvidence[] = [
    {
      eventId: relevantActivity.id,
      eventType: relevantActivity.event_type,
      timestamp: relevantActivity.timestamp,
      description: `Activity recorded ${diffHours} hours before state change${outcome ? ` with outcome: ${outcome}` : ""}`,
      actorName: getUserName(relevantActivity.actor_id),
    },
    {
      eventId: ctx.targetEvent.id,
      eventType: ctx.targetEvent.event_type,
      timestamp: ctx.targetEvent.timestamp,
      description: `State changed to ${JSON.stringify(ctx.targetEvent.new_state)}`,
      stateChange: ctx.targetEvent.new_state as Record<string, unknown>,
    },
  ];

  const chain: CausalLink[] = [
    {
      linkType: "activity_effect",
      fromEventId: relevantActivity.id,
      fromEventType: relevantActivity.event_type,
      fromTimestamp: relevantActivity.timestamp,
      toEventId: ctx.targetEvent.id,
      description: `Activity${outcome ? ` with outcome "${outcome}"` : ""} recorded ${diffHours} hours before the state change.`,
    },
  ];

  return {
    id: `causal_${uuid()}`,
    targetEventId: ctx.targetEvent.id,
    targetEventType: ctx.targetEvent.event_type,
    targetTimestamp: ctx.targetEvent.timestamp,
    rootCause: `Activity recorded ${diffHours} hours prior${outcome ? ` (outcome: ${outcome})` : ""}`,
    confidence: "possible",
    chain,
    evidence,
    explanation: `An activity was recorded ${diffHours} hours before the ${ctx.targetEvent.event_type.toLowerCase()}. ${outcome ? `The activity outcome was "${outcome}", ` : ""}which may have informed or triggered the subsequent state transition.`,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function analyzeCausality(input: CausalQueryInput): CausalAnalysis {
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const afterDate = daysAgo(lookbackDays);

  const events = getEntityEvents(input.entityType as EventEntityType, input.entityId, MAX_EVENTS);
  const recentEvents = events.filter((e) => e.timestamp >= afterDate);

  let targetEvent: CrmEvent | null = null;

  if (input.targetEventId) {
    targetEvent = recentEvents.find((e) => e.id === input.targetEventId) ?? null;
  }

  if (!targetEvent) {
    const stateChangeEvents = recentEvents.filter((e) => isStateChangeEvent(e));
    targetEvent = stateChangeEvents[stateChangeEvents.length - 1] ?? null;
  }

  if (!targetEvent) {
    return {
      entityType: input.entityType,
      entityId: input.entityId,
      analyzedAt: now(),
      chains: [],
      summary: "No state-change events found in the lookback window. Cannot determine causality.",
    };
  }

  const lookbackEvents = recentEvents.filter((e) => e.timestamp <= targetEvent.timestamp);
  const ctx: EvaluateContext = {
    targetEvent,
    events: lookbackEvents,
    lookbackDays,
  };

  const evaluators = [
    evaluateDirectCause,
    evaluateOwnerEffect,
    evaluateDependencyEffect,
    evaluateTaskCompletionEffect,
    evaluateActivityEffect,
    evaluateTemporalPattern,
  ];

  const chains: CausalChain[] = [];
  for (const evaluator of evaluators) {
    const chain = evaluator(ctx);
    if (chain) chains.push(chain);
  }

  chains.sort((a, b) => {
    const order = { certain: 0, likely: 1, possible: 2 };
    return (order[a.confidence] ?? 2) - (order[b.confidence] ?? 2);
  });

  const summary =
    chains.length > 0
      ? `Found ${chains.length} causal chain(s) for ${targetEvent.event_type} on ${input.entityType}:${input.entityId}. Primary cause: ${chains[0].rootCause} (${chains[0].confidence} confidence).`
      : `No causal chain could be established for ${targetEvent.event_type} on ${input.entityType}:${input.entityId}. The state change may be uncorrelated with preceding events.`;

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    analyzedAt: now(),
    chains,
    summary,
  };
}

export function getCausalChainTypes(): CausalLinkType[] {
  return [
    "direct_cause",
    "owner_effect",
    "dependency_effect",
    "temporal_pattern",
    "task_completion_effect",
    "activity_effect",
  ];
}

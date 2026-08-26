export type CausalConfidence = "certain" | "likely" | "possible";

export type CausalLinkType =
  | "direct_cause"
  | "owner_effect"
  | "dependency_effect"
  | "temporal_pattern"
  | "task_completion_effect"
  | "activity_effect";

export interface CausalEvidence {
  eventId: string;
  eventType: string;
  timestamp: string;
  description: string;
  stateChange?: Record<string, unknown>;
  actorName?: string;
}

export interface CausalLink {
  linkType: CausalLinkType;
  fromEventId: string;
  fromEventType: string;
  fromTimestamp: string;
  toEventId: string;
  description: string;
}

export interface CausalChain {
  id: string;
  targetEventId: string;
  targetEventType: string;
  targetTimestamp: string;
  rootCause: string;
  confidence: CausalConfidence;
  chain: CausalLink[];
  evidence: CausalEvidence[];
  explanation: string;
}

export interface CausalAnalysis {
  entityType: string;
  entityId: string;
  analyzedAt: string;
  chains: CausalChain[];
  summary: string;
}

export interface CausalQueryInput {
  entityType: string;
  entityId: string;
  targetEventId?: string;
  lookbackDays?: number;
}

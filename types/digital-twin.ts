export type DigitalTwinEntityType =
  | "customer"
  | "lead"
  | "deal"
  | "task"
  | "activity"
  | "user"
  | "contact"
  | "note"
  | "process";

export interface DigitalTwinNode {
  id: string;
  type: DigitalTwinEntityType;
  label: string;
  sublabel?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface DigitalTwinEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  label?: string;
}

export interface DigitalTwinEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  source: string | null;
}

export interface DigitalTwinProcess {
  id: string;
  definitionId: string;
  definitionName: string;
  status: string;
  currentNodeId?: string;
  startedAt: string;
  completedAt?: string;
}

export interface DigitalTwinDecision {
  ruleId: string;
  ruleName: string;
  severity: string;
  priority: string;
  triggered: boolean;
  description: string;
  recommendedAction: string;
  evidence: Array<{
    type: string;
    description: string;
    data: Record<string, unknown>;
  }>;
}

export interface DigitalTwinCausalChain {
  id: string;
  rootCause: string;
  confidence: string;
  description: string;
  explanation: string;
}

export interface DigitalTwinRelationshipContact {
  id: string;
  type: string;
  name: string | null;
  role: string;
  strength: number;
  factors: string[];
}

export interface DigitalTwinImpactMap {
  entityId: string;
  entityName: string | null;
  overallStrength: number;
  relationships: DigitalTwinRelationshipContact[];
  weakPoints: string[];
  missingRelationships: string[];
}

export interface DigitalTwinBottleneck {
  type: "process" | "owner" | "stage" | "value" | "relationship";
  label: string;
  description: string;
  severity: "critical" | "warning" | "info";
  source: string;
}

export interface DigitalTwinConcentration {
  dimension: string;
  value: number;
  max: number;
  label: string;
}

export interface DigitalTwinSnapshot {
  generated_at: string;
  focus_entity: {
    entity_type: DigitalTwinEntityType;
    entity_id: string;
    label: string;
    state: Record<string, unknown>;
  };
  entities: DigitalTwinNode[];
  relationships: DigitalTwinEdge[];
  dependencies: DigitalTwinCausalChain[];
  processes: DigitalTwinProcess[];
  recent_events: DigitalTwinEvent[];
  decisions: DigitalTwinDecision[];
  causal_context: {
    summary: string;
    chains: DigitalTwinCausalChain[];
  };
  impact_map: DigitalTwinImpactMap | null;
  bottlenecks: DigitalTwinBottleneck[];
  concentration: DigitalTwinConcentration[];
}

export interface DigitalTwinQueryInput {
  entityType: DigitalTwinEntityType;
  entityId: string;
  lookbackDays?: number;
  maxEvents?: number;
  maxProcesses?: number;
  maxDecisions?: number;
  maxEntities?: number;
}

export interface DigitalTwinSearchResultItem {
  entityType: DigitalTwinEntityType;
  entityId: string;
  displayName: string;
  isAiCopy: boolean;
  secondaryText?: string;
}

export interface DigitalTwinSearchGroup {
  customers: DigitalTwinSearchResultItem[];
  leads: DigitalTwinSearchResultItem[];
  deals: DigitalTwinSearchResultItem[];
  employees: DigitalTwinSearchResultItem[];
}

export interface DigitalTwinSearchResponse {
  query: string;
  results: DigitalTwinSearchGroup;
}

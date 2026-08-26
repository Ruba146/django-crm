export type DecisionPriority = "high" | "medium" | "low";
export type DecisionSeverity = "critical" | "warning" | "info";

export type DecisionRuleId =
  | "follow_up_overdue"
  | "task_overdue"
  | "stage_stagnation"
  | "owner_overloaded"
  | "value_decline"
  | "probability_mismatch"
  | "inactive_customer"
  | "high_value_no_contact"
  | "missing_owner"
  | "contract_expiring";

export interface DecisionEvidence {
  type: string;
  description: string;
  data: Record<string, unknown>;
}

export interface DecisionRule {
  id: DecisionRuleId;
  name: string;
  description: string;
  severity: DecisionSeverity;
  priority: DecisionPriority;
}

export interface DecisionResult {
  ruleId: DecisionRuleId;
  ruleName: string;
  severity: DecisionSeverity;
  priority: DecisionPriority;
  triggered: boolean;
  description: string;
  recommendedAction: string;
  evidence: DecisionEvidence[];
  affectedEntity: {
    entityType: string;
    entityId: string;
    label: string;
  };
}

export interface DecisionAnalysis {
  entityType: string;
  entityId: string;
  analyzedAt: string;
  results: DecisionResult[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export interface DecisionQueryInput {
  entityType: string;
  entityId: string;
  rules?: DecisionRuleId[];
}

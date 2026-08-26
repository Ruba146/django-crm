export type ProcessNodeType =
  | "trigger"
  | "condition"
  | "decision"
  | "action"
  | "wait"
  | "event"
  | "completion"
  | "failure";

export type ProcessInstanceStatus = "running" | "completed" | "failed" | "cancelled" | "waiting";

export type ProcessStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type ProcessActionType = "create_task" | "create_activity" | "create_note" | "update_entity" | "record_event" | "set_context";

export interface ProcessTrigger {
  type: "event" | "manual";
  eventType?: string;
  entityType?: string;
  condition?: string;
}

export interface ProcessCondition {
  expression: string;
  trueTarget: string;
  falseTarget: string;
}

export interface ProcessDecisionBranch {
  name: string;
  condition: string;
  target: string;
}

export interface ProcessDecision {
  branches: ProcessDecisionBranch[];
  defaultTarget: string;
}

export interface ProcessAction {
  type: ProcessActionType;
  params: Record<string, unknown>;
  next: string;
}

export interface ProcessWait {
  durationSeconds: number;
  next: string;
}

export interface ProcessEvent {
  eventType: string;
  metadata?: Record<string, unknown>;
  next: string;
}

export interface ProcessNode {
  id: string;
  type: ProcessNodeType;
  name: string;
  config: Record<string, unknown>;
  next?: string;
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: ProcessTrigger;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessDefinitionInput {
  name: string;
  description?: string;
  trigger: ProcessTrigger;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

export interface ProcessExecutionContext {
  entityType: string;
  entityId: string;
  actorId?: string;
  variables: Record<string, unknown>;
}

export interface CompiledProcess {
  definition: ProcessDefinition;
  nodes: Map<string, ProcessNode>;
  edges: Map<string, ProcessEdge[]>;
  triggerNode: ProcessNode | null;
  terminalNodes: Set<string>;
}

export interface ProcessInstance {
  id: string;
  definitionId: string;
  entityType: string;
  entityId: string;
  status: ProcessInstanceStatus;
  currentNodeId?: string;
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProcessInstanceInput {
  definitionId: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  context?: Record<string, unknown>;
  correlationId?: string;
}

export interface ProcessStepExecution {
  id: string;
  instanceId: string;
  nodeId: string;
  status: ProcessStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProcessExecutionLog {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeType: ProcessNodeType;
  status: ProcessStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProcessInstanceFilter {
  definitionId?: string;
  entityType?: string;
  entityId?: string;
  status?: ProcessInstanceStatus;
}

export interface ConditionResult {
  passed: boolean;
  value: unknown;
}

export interface ProcessCompileError {
  nodeId: string;
  message: string;
}

export interface ProcessCompileResult {
  success: boolean;
  process?: CompiledProcess;
  errors: ProcessCompileError[];
}

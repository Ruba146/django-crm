import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";
import { recordEvent } from "@/services/event.service";
import { createMemory } from "@/services/graph.service";
import { getAllDecisionRuleIds } from "@/services/decision.service";
import type { EntityType as EventEntityType, EventType } from "@/types/events";
import type { EntityType as GraphEntityType } from "@/types/graph";
import type {
  CompiledProcess,
  ConditionResult,
  CreateProcessDefinitionInput,
  CreateProcessInstanceInput,
  ProcessAction,
  ProcessCompileResult,
  ProcessCondition,
  ProcessDecision,
  ProcessDefinition,
  ProcessEdge,
  ProcessEvent,
  ProcessInstance,
  ProcessInstanceFilter,
  ProcessNode,
  ProcessNodeType,
  ProcessStepExecution,
  ProcessInstanceStatus,
  ProcessTrigger,
  ProcessWait,
} from "@/types/process";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Condition Evaluator                                                 */
/* ------------------------------------------------------------------ */

function resolveValue(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function evaluateCondition(expression: string, context: Record<string, unknown>): ConditionResult {
  const operators = [
    { op: " contains ", fn: (a: unknown, b: unknown) => String(a ?? "").includes(String(b ?? "")) },
    { op: " == ", fn: (a: unknown, b: unknown) => a == b },
    { op: " != ", fn: (a: unknown, b: unknown) => a != b },
    { op: " >= ", fn: (a: unknown, b: unknown) => Number(a) >= Number(b) },
    { op: " <= ", fn: (a: unknown, b: unknown) => Number(a) <= Number(b) },
    { op: " > ", fn: (a: unknown, b: unknown) => Number(a) > Number(b) },
    { op: " < ", fn: (a: unknown, b: unknown) => Number(a) < Number(b) },
  ];

  for (const { op, fn } of operators) {
    const idx = expression.indexOf(op);
    if (idx !== -1) {
      const left = expression.slice(0, idx).trim();
      const right = expression.slice(idx + op.length).trim();
      const leftValue = resolveValue(context, left);
      let rightValue: unknown = right;
      const num = Number(right);
      if (right === "true") rightValue = true;
      else if (right === "false") rightValue = false;
      else if (right === "null") rightValue = null;
      else if (!isNaN(num) && right !== "") rightValue = num;

      return { passed: fn(leftValue, rightValue), value: { left: leftValue, right: rightValue, operator: op.trim() } };
    }
  }

  return { passed: false, value: null };
}

/* ------------------------------------------------------------------ */
/* Process Compiler                                                    */
/* ------------------------------------------------------------------ */

export function compileProcess(definition: ProcessDefinition): ProcessCompileResult {
  const errors: { nodeId: string; message: string }[] = [];
  const nodes = new Map<string, ProcessNode>();
  const edges = new Map<string, ProcessEdge[]>();
  let triggerNode: ProcessNode | null = null;
  const terminalNodes = new Set<string>();

  if (!definition.nodes || definition.nodes.length === 0) {
    return { success: false, errors: [{ nodeId: "", message: "Process must contain at least one node." }] };
  }

  for (const node of definition.nodes) {
    if (nodes.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Duplicate node id: ${node.id}` });
    }
    nodes.set(node.id, node);
    edges.set(node.id, []);

    if (node.type === "trigger") {
      if (triggerNode) {
        errors.push({ nodeId: node.id, message: "Process must have exactly one trigger node." });
      }
      triggerNode = node;
    }

    if (node.type === "completion" || node.type === "failure") {
      terminalNodes.add(node.id);
    }
  }

  if (!triggerNode) {
    errors.push({ nodeId: "", message: "Process must have a trigger node." });
  }

  if (terminalNodes.size === 0) {
    errors.push({ nodeId: "", message: "Process must have at least one terminal node (completion or failure)." });
  }

  for (const edge of definition.edges) {
    if (!nodes.has(edge.source)) {
      errors.push({ nodeId: edge.source, message: `Edge source references unknown node: ${edge.source}` });
    }
    if (!nodes.has(edge.target)) {
      errors.push({ nodeId: edge.target, message: `Edge target references unknown node: ${edge.target}` });
    }
    if (nodes.has(edge.source)) {
      edges.get(edge.source)!.push(edge);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const compiled: CompiledProcess = {
    definition,
    nodes,
    edges,
    triggerNode,
    terminalNodes,
  };

  return { success: true, process: compiled, errors: [] };
}

function toGraphEntityType(entityType: string): GraphEntityType {
  return entityType as GraphEntityType;
}

/* ------------------------------------------------------------------ */
/* Action Executor                                                     */
/* ------------------------------------------------------------------ */

function executeAction(action: ProcessAction, context: Record<string, unknown>, instanceId: string): Record<string, unknown> {
  const db = getDb();
  const entityType = (context.entityType as string) || (action.params.entity_type as string);
  const entityId = (context.entityId as string) || (action.params.entity_id as string);

  switch (action.type) {
    case "create_task": {
      const title = (action.params.title as string) || "Process task";
      const description = (action.params.description as string) || null;
      const assigneeId = (action.params.assignee_id as string) || null;
      const dueAt = (action.params.due_at as string) || null;
      const taskEntityType = entityType || "deal";
      const taskEntityId = entityId || "";
      const id = `tsk_${uuid()}`;
      const timestamp = now();

      db.prepare(`
        INSERT INTO ${TABLES.tasks} (id, entity_type, entity_id, title, description, mode, assignee_id, due_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, taskEntityType, taskEntityId, title, description, "task", assigneeId, dueAt, timestamp, timestamp);

      recordEvent({
        event_type: "TASK_CREATED",
        entity_type: "task",
        entity_id: id,
        actor_id: (context.actorId as string) || null,
        source: "system",
        correlation_id: instanceId,
        new_state: { title, entity_type: taskEntityType, entity_id: taskEntityId },
      });

      return { createdId: id, title, entity_type: taskEntityType, entity_id: taskEntityId };
    }

    case "create_activity": {
      const body = (action.params.body as string) || "Process activity";
      const direction = (action.params.direction as string) || "outbound";
      const activityEntityType = entityType || "deal";
      const activityEntityId = entityId || "";
      const id = `act_${uuid()}`;
      const timestamp = now();

      db.prepare(`
        INSERT INTO ${TABLES.activities} (id, entity_type, entity_id, body, direction, user_id, occurred_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, activityEntityType, activityEntityId, body, direction, (context.actorId as string) || null, timestamp, timestamp, timestamp);

      recordEvent({
        event_type: "ACTIVITY_CREATED",
        entity_type: "activity",
        entity_id: id,
        actor_id: (context.actorId as string) || null,
        source: "system",
        correlation_id: instanceId,
        new_state: { body, entity_type: activityEntityType, entity_id: activityEntityId },
      });

      return { createdId: id, body, entity_type: activityEntityType, entity_id: activityEntityId };
    }

    case "create_note": {
      const body = (action.params.body as string) || "Process note";
      const noteEntityType = entityType || "deal";
      const noteEntityId = entityId || "";
      const id = `nte_${uuid()}`;
      const timestamp = now();

      db.prepare(`
        INSERT INTO ${TABLES.notes} (id, entity_type, entity_id, body, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, noteEntityType, noteEntityId, body, timestamp, timestamp);

      recordEvent({
        event_type: "NOTE_CREATED",
        entity_type: "note",
        entity_id: id,
        actor_id: (context.actorId as string) || null,
        source: "system",
        correlation_id: instanceId,
        new_state: { body, entity_type: noteEntityType, entity_id: noteEntityId },
      });

      return { createdId: id, body, entity_type: noteEntityType, entity_id: noteEntityId };
    }

    case "record_event": {
      const eventType = (action.params.event_type as string) || "ENTITY_UPDATED";
      const metadata = (action.params.metadata as Record<string, unknown>) || {};
      const id = `evt_${uuid()}`;
      const timestamp = now();

      db.prepare(`
        INSERT INTO ${TABLES.events} (id, event_type, entity_type, entity_id, actor_id, timestamp, metadata, correlation_id, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, eventType, entityType || "deal", entityId || "", (context.actorId as string) || null, timestamp, JSON.stringify(metadata), instanceId, "system");

      return { createdEventId: id, eventType };
    }

    case "set_context": {
      const key = action.params.key as string;
      const value = action.params.value;
      if (key) {
        return { [key]: value };
      }
      return {};
    }

    case "update_entity": {
      const field = action.params.field as string;
      const value = action.params.value;
      if (!field || !entityType || !entityId) return {};
      const table = entityType === "customer" ? TABLES.customers : entityType === "lead" ? TABLES.leads : entityType === "deal" ? TABLES.deals : null;
      if (!table) return {};
      db.prepare(`UPDATE ${table} SET ${field} = ?, updated_at = ? WHERE id = ?`).run(value, now(), entityId);
      return { updatedField: field, value };
    }

    default:
      return { error: `Unknown action type: ${action.type}` };
  }
}

/* ------------------------------------------------------------------ */
/* Wait Handler                                                        */
/* ------------------------------------------------------------------ */

function calculateWaitUntil(durationSeconds: number): string {
  const until = new Date();
  until.setSeconds(until.getSeconds() + durationSeconds);
  return until.toISOString();
}

/* ------------------------------------------------------------------ */
/* Event Emitter                                                       */
/* ------------------------------------------------------------------ */

function emitProcessEvent(eventType: string, metadata: Record<string, unknown> | undefined, instanceId: string, entityType: string, entityId: string): void {
  recordEvent({
    event_type: eventType as EventType,
    entity_type: entityType as EventEntityType,
    entity_id: entityId,
    actor_id: null,
    metadata: metadata || {},
    correlation_id: instanceId,
    source: "system",
  });
}

/* ------------------------------------------------------------------ */
/* Database Operations                                                 */
/* ------------------------------------------------------------------ */

export function initProcessTables(): void {
  const db = getDb();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS process_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      trigger TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS process_instances (
      id TEXT PRIMARY KEY,
      definition_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      current_node_id TEXT,
      context TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      correlation_id TEXT,
      metadata TEXT,
      wait_until TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS process_executions (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT NOT NULL DEFAULT '{}',
      output TEXT,
      error TEXT,
      started_at TEXT,
      completed_at TEXT
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_process_instances_definition ON process_instances (definition_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_process_instances_entity ON process_instances (entity_type, entity_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_process_instances_status ON process_instances (status)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_process_executions_instance ON process_executions (instance_id)`).run();
}

export function createProcessDefinition(input: CreateProcessDefinitionInput): ProcessDefinition {
  initProcessTables();
  const db = getDb();
  const id = `proc_def_${uuid()}`;
  const timestamp = now();

  db.prepare(`
    INSERT INTO process_definitions (id, name, description, is_active, trigger, nodes, edges, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    1,
    JSON.stringify(input.trigger),
    JSON.stringify(input.nodes),
    JSON.stringify(input.edges),
    timestamp,
    timestamp
  );

  return {
    id,
    name: input.name,
    description: input.description,
    isActive: true,
    trigger: input.trigger,
    nodes: input.nodes,
    edges: input.edges,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getProcessDefinition(id: string): ProcessDefinition | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, name, description, is_active, trigger, nodes, edges, created_at, updated_at
    FROM process_definitions WHERE id = ? LIMIT 1
  `).get(id) as
    | { id: string; name: string; description: string | null; is_active: number; trigger: string; nodes: string; edges: string; created_at: string; updated_at: string }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    isActive: row.is_active === 1,
    trigger: JSON.parse(row.trigger) as ProcessTrigger,
    nodes: JSON.parse(row.nodes) as ProcessNode[],
    edges: JSON.parse(row.edges) as ProcessEdge[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getProcessDefinitions(): ProcessDefinition[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, description, is_active, trigger, nodes, edges, created_at, updated_at
    FROM process_definitions ORDER BY created_at DESC
  `).all() as Array<{
    id: string; name: string; description: string | null; is_active: number; trigger: string; nodes: string; edges: string; created_at: string; updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    isActive: row.is_active === 1,
    trigger: JSON.parse(row.trigger) as ProcessTrigger,
    nodes: JSON.parse(row.nodes) as ProcessNode[],
    edges: JSON.parse(row.edges) as ProcessEdge[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateProcessDefinition(id: string, input: Partial<CreateProcessDefinitionInput>): ProcessDefinition | null {
  const db = getDb();
  const existing = getProcessDefinition(id);
  if (!existing) return null;

  const name = input.name ?? existing.name;
  const description = input.description ?? existing.description;
  const trigger = input.trigger ?? existing.trigger;
  const nodes = input.nodes ?? existing.nodes;
  const edges = input.edges ?? existing.edges;
  const timestamp = now();

  db.prepare(`
    UPDATE process_definitions SET name = ?, description = ?, trigger = ?, nodes = ?, edges = ?, updated_at = ? WHERE id = ?
  `).run(name, description || null, JSON.stringify(trigger), JSON.stringify(nodes), JSON.stringify(edges), timestamp, id);

  return {
    id,
    name,
    description,
    isActive: existing.isActive,
    trigger,
    nodes,
    edges,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
  };
}

export function deleteProcessDefinition(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM process_definitions WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function startProcess(input: CreateProcessInstanceInput): ProcessInstance {
  initProcessTables();
  const definition = getProcessDefinition(input.definitionId);
  if (!definition) throw new Error(`Process definition not found: ${input.definitionId}`);

  const compileResult = compileProcess(definition);
  if (!compileResult.success) {
    throw new Error(`Cannot compile process: ${compileResult.errors.map((e) => e.message).join(", ")}`);
  }

  if (!compileResult.process || !compileResult.process.triggerNode) {
    throw new Error(`Cannot compile process: ${compileResult.errors.map((e) => e.message).join(", ")}`);
  }

  const db = getDb();
  const id = `proc_inst_${uuid()}`;
  const timestamp = now();
  const context = {
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId || null,
    variables: input.context || {},
    ...(input.context || {}),
  };

  db.prepare(`
    INSERT INTO process_instances (id, definition_id, entity_type, entity_id, status, current_node_id, context, started_at, correlation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.definitionId, input.entityType, input.entityId, "running", compileResult.process.triggerNode.id, JSON.stringify(context), timestamp, input.correlationId || null);

  createMemory({
    entity_type: toGraphEntityType(input.entityType),
    entity_id: input.entityId,
    memory_type: "decision",
    content: `Process started: ${definition.name}`,
    metadata: { processInstanceId: id, definitionId: input.definitionId },
    source: "process_compiler",
  });

  recordEvent({
    event_type: "ENTITY_UPDATED",
    entity_type: input.entityType as EventEntityType,
    entity_id: input.entityId,
    actor_id: input.actorId || null,
    source: "system",
    correlation_id: id,
    metadata: { processDefinitionId: input.definitionId, processInstanceId: id, action: "process_started" },
  });

  return {
    id,
    definitionId: input.definitionId,
    entityType: input.entityType,
    entityId: input.entityId,
    status: "running",
    currentNodeId: compileResult.process!.triggerNode.id,
    context,
    startedAt: timestamp,
    correlationId: input.correlationId,
  };
}

export function getProcessInstance(id: string): ProcessInstance | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, definition_id, entity_type, entity_id, status, current_node_id, context, started_at, completed_at, correlation_id, metadata, wait_until
    FROM process_instances WHERE id = ? LIMIT 1
  `).get(id) as
    | { id: string; definition_id: string; entity_type: string; entity_id: string; status: string; current_node_id: string | null; context: string; started_at: string; completed_at: string | null; correlation_id: string | null; metadata: string | null; wait_until: string | null }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    definitionId: row.definition_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status as ProcessInstanceStatus,
    currentNodeId: row.current_node_id || undefined,
    context: JSON.parse(row.context),
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    correlationId: row.correlation_id || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function getProcessInstances(filter?: ProcessInstanceFilter): ProcessInstance[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.definitionId) {
    conditions.push(`definition_id = ?`);
    params.push(filter.definitionId);
  }
  if (filter?.entityType) {
    conditions.push(`entity_type = ?`);
    params.push(filter.entityType);
  }
  if (filter?.entityId) {
    conditions.push(`entity_id = ?`);
    params.push(filter.entityId);
  }
  if (filter?.status) {
    conditions.push(`status = ?`);
    params.push(filter.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT id, definition_id, entity_type, entity_id, status, current_node_id, context, started_at, completed_at, correlation_id, metadata
    FROM process_instances ${where} ORDER BY started_at DESC
  `).all(...params) as Array<{
    id: string; definition_id: string; entity_type: string; entity_id: string; status: string; current_node_id: string | null; context: string; started_at: string; completed_at: string | null; correlation_id: string | null; metadata: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    definitionId: row.definition_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status as ProcessInstanceStatus,
    currentNodeId: row.current_node_id || undefined,
    context: JSON.parse(row.context),
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    correlationId: row.correlation_id || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

function updateProcessInstanceState(instanceId: string, updates: Record<string, unknown>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    sets.push(`${key} = ?`);
    if (typeof value === "object" && value !== null) {
      values.push(JSON.stringify(value));
    } else {
      values.push(value);
    }
  }

  values.push(instanceId);
  db.prepare(`UPDATE process_instances SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

function createExecutionLog(execution: ProcessStepExecution, nodeType: ProcessNodeType): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO process_executions (id, instance_id, node_id, node_type, status, input, output, error, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    execution.id,
    execution.instanceId,
    execution.nodeId,
    nodeType,
    execution.status,
    JSON.stringify(execution.input),
    execution.output ? JSON.stringify(execution.output) : null,
    execution.error || null,
    execution.startedAt || null,
    execution.completedAt || null
  );
}

function updateExecutionLog(execution: ProcessStepExecution): void {
  const db = getDb();
  db.prepare(`
    UPDATE process_executions SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ?
  `).run(
    execution.status,
    execution.output ? JSON.stringify(execution.output) : null,
    execution.error || null,
    execution.completedAt || null,
    execution.id
  );
}

function getNodeTypeForLog(node: ProcessNode): ProcessNodeType {
  return node.type;
}

export function executeStep(instanceId: string): ProcessStepExecution | null {
  const instance = getProcessInstance(instanceId);
  if (!instance) return null;
  if (instance.status !== "running") return null;

  const definition = getProcessDefinition(instance.definitionId);
  if (!definition) return null;

  const compileResult = compileProcess(definition);
  if (!compileResult.success) {
    updateProcessInstanceState(instanceId, { status: "failed", completed_at: now() });
    return null;
  }

  const process = compileResult.process!;
  if (!process.triggerNode) return null;
  const currentNodeId = instance.currentNodeId || process.triggerNode.id;
  const node = process.nodes.get(currentNodeId);
  if (!node) return null;

  const execution: ProcessStepExecution = {
    id: `exec_${uuid()}`,
    instanceId,
    nodeId: currentNodeId,
    status: "running",
    input: { ...instance.context },
    output: {},
    startedAt: now(),
  };

  createExecutionLog(execution, getNodeTypeForLog(node));

  try {
    switch (node.type) {
      case "trigger": {
        const outgoingEdges = process.edges.get(currentNodeId) || [];
        if (outgoingEdges.length > 0) {
          updateProcessInstanceState(instanceId, { current_node_id: outgoingEdges[0].target });
        }
        execution.status = "completed";
        break;
      }

      case "condition": {
        const condition = node.config as unknown as ProcessCondition;
        const result = evaluateCondition(condition.expression, instance.context);
        execution.output = { conditionResult: result };
        execution.status = "completed";
        const nextNodeId = result.passed ? condition.trueTarget : condition.falseTarget;
        updateProcessInstanceState(instanceId, { current_node_id: nextNodeId });
        break;
      }

      case "decision": {
        const decision = node.config as unknown as ProcessDecision;
        let matchedBranch: string | undefined;
        let matchedOutput: Record<string, unknown> = {};

        for (const branch of decision.branches) {
          const result = evaluateCondition(branch.condition, instance.context);
          if (result.passed) {
            matchedBranch = branch.target;
            matchedOutput = { matchedBranch: branch.name, conditionResult: result };
            break;
          }
        }

        if (!matchedBranch) {
          matchedBranch = decision.defaultTarget;
        }

        execution.output = matchedOutput;
        execution.status = "completed";
        updateProcessInstanceState(instanceId, { current_node_id: matchedBranch });
        break;
      }

      case "action": {
        const action = node.config as unknown as ProcessAction;
        const output = executeAction(action, instance.context, instanceId);
        execution.output = output;
        execution.status = "completed";
        updateProcessInstanceState(instanceId, { current_node_id: action.next, context: { ...instance.context, ...output } });
        break;
      }

      case "wait": {
        const wait = node.config as unknown as ProcessWait;
        const waitUntil = calculateWaitUntil(wait.durationSeconds);
        execution.output = { waitUntil, durationSeconds: wait.durationSeconds };
        execution.status = "completed";
        updateProcessInstanceState(instanceId, { status: "waiting", wait_until: waitUntil, current_node_id: wait.next });
        break;
      }

      case "event": {
        const event = node.config as unknown as ProcessEvent;
        emitProcessEvent(event.eventType, event.metadata, instanceId, instance.entityType, instance.entityId);
        execution.output = { eventType: event.eventType };
        execution.status = "completed";
        updateProcessInstanceState(instanceId, { current_node_id: event.next });
        break;
      }

      case "completion": {
        execution.output = { message: "Process completed successfully" };
        execution.status = "completed";
        updateProcessInstanceState(instanceId, { status: "completed", completed_at: now(), current_node_id: undefined });
        createMemory({
          entity_type: toGraphEntityType(instance.entityType),
          entity_id: instance.entityId,
          memory_type: "decision",
          content: `Process completed: ${definition.name}`,
          metadata: { processInstanceId: instanceId, definitionId: instance.definitionId },
          source: "process_compiler",
        });
        recordEvent({
          event_type: "ENTITY_UPDATED",
          entity_type: instance.entityType as EventEntityType,
          entity_id: instance.entityId,
          actor_id: (instance.context.actorId as string) || null,
          source: "system",
          correlation_id: instanceId,
          metadata: { processDefinitionId: instance.definitionId, processInstanceId: instanceId, action: "process_completed" },
        });
        break;
      }

      case "failure": {
        const reason = (node.config.reason as string) || "Process failed";
        execution.output = { reason };
        execution.status = "completed";
        execution.error = reason;
        updateProcessInstanceState(instanceId, { status: "failed", completed_at: now(), current_node_id: undefined });
        createMemory({
          entity_type: toGraphEntityType(instance.entityType),
          entity_id: instance.entityId,
          memory_type: "decision",
          content: `Process failed: ${definition.name} - ${reason}`,
          metadata: { processInstanceId: instanceId, definitionId: instance.definitionId, reason },
          source: "process_compiler",
        });
        recordEvent({
          event_type: "ENTITY_UPDATED",
          entity_type: instance.entityType as EventEntityType,
          entity_id: instance.entityId,
          actor_id: (instance.context.actorId as string) || null,
          source: "system",
          correlation_id: instanceId,
          metadata: { processDefinitionId: instance.definitionId, processInstanceId: instanceId, action: "process_failed", reason },
        });
        break;
      }

      default:
        execution.status = "failed";
        execution.error = `Unknown node type: ${node.type}`;
        updateProcessInstanceState(instanceId, { status: "failed", completed_at: now() });
  }
  } catch (error) {
    execution.status = "failed";
    execution.error = error instanceof Error ? error.message : String(error);
    updateProcessInstanceState(instanceId, { status: "failed", completed_at: now() });
  }

  execution.completedAt = now();
  updateExecutionLog(execution);

  return execution;
}

export function executeProcess(instanceId: string): ProcessStepExecution[] {
  const executions: ProcessStepExecution[] = [];
  let step: ProcessStepExecution | null;
  const MAX_STEPS = 50;

  for (let i = 0; i < MAX_STEPS; i++) {
    step = executeStep(instanceId);
    if (!step) break;
    executions.push(step);

    const instance = getProcessInstance(instanceId);
    if (!instance || instance.status !== "running") break;
    if (step.status === "failed") break;
  }

  return executions;
}

export function cancelProcess(instanceId: string): ProcessInstance | null {
  const instance = getProcessInstance(instanceId);
  if (!instance) return null;
  if (instance.status === "completed" || instance.status === "failed" || instance.status === "cancelled") return instance;

  updateProcessInstanceState(instanceId, { status: "cancelled", completed_at: now() });

  return { ...instance, status: "cancelled", completedAt: now() };
}

export function resumeExpiredWaits(): number {
  const db = getDb();
  const nowIso = now();
  const rows = db.prepare(`
    SELECT id FROM process_instances WHERE status = 'waiting' AND wait_until IS NOT NULL AND wait_until <= ?
  `).all(nowIso) as { id: string }[];

  for (const row of rows) {
    updateProcessInstanceState(row.id, { status: "running", wait_until: null });
  }

  return rows.length;
}

export function triggerProcessFromEvent(eventType: string, entityType: string, entityId: string): ProcessInstance[] {
  const db = getDb();
  const definitions = db.prepare(`
    SELECT id FROM process_definitions WHERE is_active = 1 AND trigger LIKE ?
  `).all(`%"eventType":"${eventType}"%`) as { id: string }[];

  const instances: ProcessInstance[] = [];
  for (const def of definitions) {
    const existing = db.prepare(`
      SELECT id FROM process_instances WHERE definition_id = ? AND entity_type = ? AND entity_id = ? AND status IN ('running', 'waiting')
    `).get(def.id, entityType, entityId) as { id: string } | undefined;
    if (existing) continue;

    try {
      const instance = startProcess({ definitionId: def.id, entityType, entityId });
      executeProcess(instance.id);
      instances.push(instance);
    } catch {
      // skip failed triggers
    }
  }

  return instances;
}

export function getAllProcessRuleIds(): string[] {
  return getAllDecisionRuleIds();
}

import type { AIAction, ActionType, PageContext } from "@/types/ai-chat";

const ACTION_PATTERN = /<!--\s*ACTION_JSON:(\{[\s\S]*?\})\s*-->/g;

const VALID_TYPES: ActionType[] = [
  "create_task",
  "create_activity",
  "create_lead",
  "create_deal",
  "create_note",
  "update_deal_stage",
  "assign_owner",
  "schedule_followup",
];

const REQUIRED_FIELDS: Record<ActionType, string[]> = {
  create_task: ["title"],
  create_activity: ["body"],
  create_lead: ["full_name"],
  create_deal: ["name"],
  create_note: ["body"],
  update_deal_stage: ["deal_id", "stage_id"],
  assign_owner: ["entity_type", "entity_id", "owner_id"],
  schedule_followup: ["title", "due_at"],
};

export function parseActionsFromResponse(
  text: string,
  context: PageContext
): AIAction[] {
  const actions: AIAction[] = [];

  if (!ACTION_PATTERN.test(text)) {
    return actions;
  }

  ACTION_PATTERN.lastIndex = 0;
  const matches = text.matchAll(ACTION_PATTERN);

  for (const match of matches) {
    try {
      const raw = JSON.parse(match[1]);
      const type = raw.type as ActionType | undefined;
      if (type && VALID_TYPES.includes(type)) {
        const params = (raw.params as Record<string, unknown>) || {};

        const contextAwareTypes: ActionType[] = ["create_task", "create_activity", "create_note", "update_deal_stage", "assign_owner", "schedule_followup"];
        if (contextAwareTypes.includes(type)) {
          if (context.recordId && context.recordType && !params.entity_type) {
            params.entity_type = context.recordType;
          }
          if (context.recordId && !params.entity_id) {
            params.entity_id = context.recordId;
          }
        }

        actions.push({
          id: crypto.randomUUID(),
          type,
          label: (raw.label as string) || formatActionLabel(type),
          params,
          context,
        });
      }
    } catch {
      // skip unparseable blocks
    }
  }

  return actions;
}

export function stripActionMarkers(text: string): string {
  return text.replace(/<!--\s*ACTION_JSON:[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
}

export function validateAction(action: AIAction): string | null {
  const required = REQUIRED_FIELDS[action.type] || [];
  for (const field of required) {
    const value = action.params[field];
    if (value === undefined || value === null || value === "") {
      return `${field} is required for ${action.type}`;
    }
  }

  const entityRequiredActions: ActionType[] = ["update_deal_stage", "assign_owner"];
  if (entityRequiredActions.includes(action.type)) {
    if (!action.params.entity_type) {
      return "entity_type is required for this action";
    }
    if (!action.params.entity_id) {
      return "entity_id is required for this action";
    }
  }

  const validEntityTypes = ["customer", "lead", "deal", "activity", "task"];
  if (action.params.entity_type && !validEntityTypes.includes(action.params.entity_type as string)) {
    return `Invalid entity_type: ${action.params.entity_type}`;
  }

  return null;
}

function formatActionLabel(type: ActionType): string {
  const labels: Record<ActionType, string> = {
    create_task: "Create Task",
    create_activity: "Create Activity",
    create_lead: "Create Lead",
    create_deal: "Create Deal",
    create_note: "Create Note",
    update_deal_stage: "Update Deal Stage",
    assign_owner: "Assign Owner",
    schedule_followup: "Schedule Follow-up",
  };
  return labels[type] || type;
}

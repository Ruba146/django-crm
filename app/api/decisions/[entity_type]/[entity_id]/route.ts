import { NextResponse } from "next/server";
import { evaluateDecisions } from "@/services/decision.service";
import type { DecisionRuleId } from "@/types/decision";
import type { EntityType } from "@/types/events";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity_type: string; entity_id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { entity_type, entity_id } = await context.params;

  const validEntityTypes = ["customer", "lead", "deal", "task", "activity", "note", "user"] as const;
  if (!validEntityTypes.includes(entity_type as typeof validEntityTypes[number])) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  const url = new URL(_request.url);
  const rulesParam = url.searchParams.get("rules");
  const rules = rulesParam ? (rulesParam.split(",") as DecisionRuleId[]) : undefined;

  const analysis = evaluateDecisions({
    entityType: entity_type as EntityType,
    entityId: entity_id,
    rules,
  });

  return NextResponse.json({ analysis });
}

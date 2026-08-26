export type RelationshipRole =
  | "decision_maker"
  | "champion"
  | "influencer"
  | "gatekeeper"
  | "blocker"
  | "primary_contact"
  | "owner"
  | "stakeholder"
  | "unknown";

export type RelationshipEntityType = "customer" | "lead" | "deal";

export interface RelationshipContact {
  id: string;
  type: "contact" | "user";
  name: string | null;
  email: string | null;
  phone: string | null;
  role: RelationshipRole;
  strength: number;
  factors: string[];
  signals: RelationshipSignals;
}

export interface RelationshipSignals {
  activityCount: number;
  lastActivityAt: string | null;
  recentActivityCount: number;
  taskCount: number;
  completedTaskCount: number;
  dealCount: number;
  wonDealCount: number;
  isOwner: boolean;
  eventCount: number;
  incomingActivityCount: number;
  outgoingActivityCount: number;
}

export interface RelationshipIntelligence {
  entityType: RelationshipEntityType;
  entityId: string;
  entityName: string | null;
  overallStrength: number;
  relationships: RelationshipContact[];
  weakPoints: string[];
  missingRelationships: string[];
}

export interface RelationshipStrengthBreakdown {
  label: string;
  value: number;
  max: number;
}

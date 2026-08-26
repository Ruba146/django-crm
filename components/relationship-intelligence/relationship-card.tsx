"use client";

import { Avatar, Badge } from "@/components/ui";
import { RelationshipStrengthBar } from "./relationship-strength-bar";
import type { RelationshipContact } from "@/types/relationship-intelligence";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

const ROLE_LABELS: Record<string, string> = {
  decision_maker: "Decision Maker",
  champion: "Champion",
  influencer: "Influencer",
  blocker: "Blocker",
  gatekeeper: "Gatekeeper",
  primary_contact: "Primary Contact",
  owner: "Owner",
  stakeholder: "Stakeholder",
  unknown: "Unknown",
};

const ROLE_VARIANTS: Record<string, "success" | "info" | "warning" | "danger" | "neutral" | "outline"> = {
  decision_maker: "danger",
  champion: "success",
  influencer: "info",
  blocker: "danger",
  gatekeeper: "warning",
  primary_contact: "success",
  owner: "info",
  stakeholder: "info",
  unknown: "neutral",
};

interface RelationshipCardProps {
  relationship: RelationshipContact;
  locale?: string;
}

export function RelationshipCard({ relationship, locale = "en" }: RelationshipCardProps) {
  const daysSinceContact = relationship.signals.lastActivityAt
    ? Math.floor((Date.now() - new Date(relationship.signals.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={relationship.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{relationship.name ?? "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">
              {relationship.type === "user" ? "Employee" : "Contact"}
            </p>
          </div>
        </div>
        <Badge variant={ROLE_VARIANTS[relationship.role] ?? "neutral"} className="shrink-0">
          {ROLE_LABELS[relationship.role] ?? relationship.role}
        </Badge>
      </div>

      <RelationshipStrengthBar score={relationship.strength} size="sm" />

      <div className="flex flex-wrap gap-1">
        {relationship.factors.map((factor, idx) => (
          <span key={idx} className="text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
            {factor}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <span>{relationship.signals.activityCount} activities</span>
        <span>{relationship.signals.taskCount} tasks</span>
        <span>{relationship.signals.dealCount} deals</span>
        <span>{relationship.signals.eventCount} events</span>
        {daysSinceContact !== null && (
          <span className={cn(daysSinceContact > 90 ? "text-danger" : daysSinceContact > 30 ? "text-warning" : "text-success")}>
            {daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago`}
          </span>
        )}
      </div>
    </div>
  );
}



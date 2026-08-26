"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RelationshipCard } from "@/components/relationship-intelligence/relationship-card";
import { AlertTriangle, Users } from "lucide-react";
import type { RelationshipContact } from "@/types/relationship-intelligence";

interface RelationshipIntelligencePanelProps {
  entityType: "customer" | "lead" | "deal";
  entityId: string;
}

export function RelationshipIntelligencePanel({ entityType, entityId }: RelationshipIntelligencePanelProps) {
  const query = useQuery({
    queryKey: ["relationship-intelligence", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/relationship-intelligence/${entityType}/${entityId}`);
      if (!res.ok) throw new Error("Failed to load relationship intelligence");
      return res.json() as Promise<{
        entityType: string;
        entityId: string;
        entityName: string | null;
        overallStrength: number;
        relationships: RelationshipContact[];
        weakPoints: string[];
        missingRelationships: string[];
      }>;
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Loading relationship intelligence...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Unable to load relationship intelligence.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = query.data;
  const users = data.relationships.filter((r) => r.type === "user");
  const contacts = data.relationships.filter((r) => r.type === "contact");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              Overall Relationship Strength
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{data.overallStrength}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average across {data.relationships.length} relationship{data.relationships.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-muted-foreground" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.weakPoints.length === 0 && data.missingRelationships.length === 0 ? (
              <p className="text-xs text-muted-foreground">No issues detected.</p>
            ) : (
              <ul className="space-y-1">
                {data.weakPoints.map((wp, i) => (
                  <li key={`wp-${i}`} className="text-xs text-warning flex items-start gap-1">
                    <span className="mt-0.5">!</span>
                    <span>{wp}</span>
                  </li>
                ))}
                {data.missingRelationships.map((mr, i) => (
                  <li key={`mr-${i}`} className="text-xs text-info flex items-start gap-1">
                    <span className="mt-0.5">+</span>
                    <span>{mr}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Employees ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No employee relationships found.</p>
            ) : (
              <div className="space-y-2">
                {users.map((r) => (
                  <RelationshipCard key={r.id} relationship={r} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contacts ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No contact relationships found.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((r) => (
                  <RelationshipCard key={r.id} relationship={r} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

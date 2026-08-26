"use client";

import { useQuery } from "@tanstack/react-query";
import { RecordSelector } from "@/components/shared/record-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch,
  Users,
  CheckSquare,
  Workflow,
  AlertTriangle,
  TrendingUp,
  RefreshCcw,
  Network,
  type LucideIcon,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { DigitalTwinSnapshot } from "@/types/digital-twin";

const SEVERITY_COLORS: Record<string, "danger" | "warning" | "info" | "success"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export function DigitalTwinClient({ initialEntityType, initialEntityId }: { initialEntityType: string; initialEntityId: string }) {
  const [entityType, setEntityType] = useState(initialEntityType);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [selectedRecord, setSelectedRecord] = useState<{
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  } | null>(null);

  const snapshotQuery = useQuery({
    queryKey: ["digital-twin", entityType, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await fetch(`/api/digital-twin/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.snapshot as DigitalTwinSnapshot;
    },
    enabled: !!entityId,
  });

  const handleSelectRecord = useCallback(
    (result: {
      entityType: string;
      entityId: string;
      displayName: string;
      secondaryText?: string;
    }) => {
      setEntityType(result.entityType);
      setEntityId(result.entityId);
      setSelectedRecord(result);
    },
    []
  );

  const handleClear = useCallback(() => {
    setEntityId("");
    setSelectedRecord(null);
  }, []);

  const snapshot = snapshotQuery.data;
  const loading = snapshotQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <RecordSelector
            onSelect={handleSelectRecord}
            selectedRecord={selectedRecord}
            onClear={handleClear}
          />
        </div>
      </div>

      {!entityId && !selectedRecord && (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Network className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Search for a customer, lead, deal, or employee to inspect its digital twin.
          </p>
        </Card>
      )}

      {loading && entityId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><Skeleton className="h-24 w-full" /></Card>
          ))}
        </div>
      )}

      {snapshot && !loading && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="size-5" />
                Current Business State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Related Entities" value={snapshot.entities.length} icon={Users} />
                <StatCard label="Active Deals" value={snapshot.entities.filter((e) => e.type === "deal").length} icon={TrendingUp} />
                <StatCard label="Open Tasks" value={snapshot.recent_events.filter((e) => e.event_type === "TASK_CREATED").length} icon={CheckSquare} />
                <StatCard label="Active Processes" value={snapshot.processes.length} icon={Workflow} />
                <StatCard label="Relationships" value={snapshot.relationships.length} icon={Network} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="size-5" />
                  Dependency Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.entities.length === 0 ? (
                  <Empty text="No related entities found." />
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{snapshot.focus_entity.label}</div>
                    <div className="space-y-1 pl-4 border-s border-border">
                      {snapshot.entities.slice(0, 10).map((entity) => (
                        <div key={entity.id} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {entity.label && entity.label !== entity.id ? entity.label : `Unnamed ${entity.type}`}
                          <Badge variant="neutral" className="text-[10px]">{entity.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Relationship State
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!snapshot.impact_map || snapshot.impact_map.relationships.length === 0 ? (
                  <Empty text="No relationship data available." />
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Overall strength: <span className="font-semibold text-foreground">{snapshot.impact_map.overallStrength}/100</span>
                    </div>
                    {snapshot.impact_map.relationships.slice(0, 8).map((rel) => (
                      <div key={rel.id} className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{rel.name ?? `Unnamed ${rel.type}`}</div>
                          <div className="text-xs text-muted-foreground capitalize">{rel.role}</div>
                        </div>
                        <Badge variant={rel.strength >= 60 ? "success" : rel.strength >= 30 ? "warning" : "danger"}>
                          {rel.strength}
                        </Badge>
                      </div>
                    ))}
                    {snapshot.impact_map.weakPoints.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {snapshot.impact_map.weakPoints.map((wp) => (
                          <div key={wp} className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            {wp}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="size-5" />
                  Process State
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.processes.length === 0 ? (
                  <Empty text="No active processes." />
                ) : (
                  <div className="space-y-2">
                    {snapshot.processes.map((proc) => (
                      <div key={proc.id} className="flex items-center justify-between text-sm">
                        <div className="font-medium">{proc.definitionName}</div>
                        <Badge variant={proc.status === "running" ? "primary" : proc.status === "waiting" ? "warning" : "neutral"}>
                          {proc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  Decisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.decisions.length === 0 ? (
                  <Empty text="No decision rules triggered." />
                ) : (
                  <div className="space-y-3">
                    {snapshot.decisions.map((decision) => (
                      <div key={decision.ruleId} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={SEVERITY_COLORS[decision.severity] ?? "neutral"}>{decision.severity}</Badge>
                          <span className="text-sm font-medium">{decision.ruleName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{decision.description}</p>
                        <p className="text-xs text-primary">Recommendation: {decision.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="size-5" />
                  How We Got Here
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Recent Events</h3>
                    {snapshot.recent_events.length === 0 ? (
                      <Empty text="No recent events." />
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {snapshot.recent_events.slice(-10).map((evt) => (
                          <div key={evt.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground">{evt.event_type}</span>
                            <span className="text-muted-foreground">{new Date(evt.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Causal Context</h3>
                    <p className="text-xs text-muted-foreground mb-2">{snapshot.causal_context.summary}</p>
                    {snapshot.causal_context.chains.length > 0 && (
                      <div className="space-y-1">
                        {snapshot.causal_context.chains.slice(0, 5).map((chain) => (
                          <div key={chain.id} className="text-xs">
                            <span className="font-medium capitalize">{chain.confidence}</span>: {chain.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.bottlenecks.length === 0 ? (
                  <Empty text="No bottlenecks detected." />
                ) : (
                  <div className="space-y-2">
                    {snapshot.bottlenecks.map((bn, idx) => (
                      <div key={idx} className="flex items-start justify-between text-sm">
                        <div>
                          <div className="font-medium">{bn.label}</div>
                          <div className="text-xs text-muted-foreground">{bn.description}</div>
                        </div>
                        <Badge variant={SEVERITY_COLORS[bn.severity] ?? "neutral"}>{bn.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5" />
                Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.concentration.length === 0 ? (
                <Empty text="No concentration data." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {snapshot.concentration.map((c) => (
                    <div key={c.dimension} className="space-y-1">
                      <div className="text-xs text-muted-foreground capitalize">{c.dimension.replace(/_/g, " ")}</div>
                      <div className="text-lg font-semibold">{c.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-5 text-muted-foreground" />
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

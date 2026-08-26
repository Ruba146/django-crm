"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus } from "lucide-react";
import type { EntityType, FixedGraphData, GraphNode } from "@/types/graph";
import { NODE_TYPE_CONFIG } from "@/types/graph";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";

interface RecordDetailsPanelProps {
  entityType: EntityType;
  entityId: string;
  fixedGraphData: FixedGraphData | null;
  onSelectNode?: (node: { entityType: string; entityId: string; displayName: string; secondaryText?: string }) => void;
}

const CRM_HREF_MAP: Record<string, string> = {
  customer: "/customers",
  lead: "/leads",
  deal: "/deals",
  task: "/tasks",
  activity: "/activities",
  user: "/settings",
  contact: "/customers",
  memory: "/graph",
};

const ORDERED_TYPES = ["customer", "lead", "deal", "activity", "task", "event", "user", "contact"];

const DETAIL_FIELDS: Record<string, Array<{ key: string; label: string; format?: (v: unknown, detail: Record<string, unknown>) => string }>> = {
  deal: [
    { key: "name", label: "Deal Name" },
    { key: "company_name", label: "Company" },
    { key: "lead_name", label: "Lead" },
    { key: "stage_label", label: "Stage" },
    { key: "terminal_type", label: "Status" },
    { key: "expected_value_minor", label: "Deal Value", format: (v, d) => formatCurrency(v as number | null, d.currency_code ? String(d.currency_code) : undefined) },
    { key: "probability_pct", label: "Probability", format: (v) => `${v}%` },
    { key: "target_close_date", label: "Expected Close", format: (v) => formatDate(v as string | null) },
    { key: "owner_name", label: "Owner" },
    { key: "created_at", label: "Created", format: (v) => formatDate(v as string | null) },
  ],
  lead: [
    { key: "full_name", label: "Full Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "company_name", label: "Company" },
    { key: "stage_label", label: "Stage" },
    { key: "source_label", label: "Source" },
    { key: "is_terminal", label: "Status", format: (v) => (v ? "Closed" : "Open") },
    { key: "owner_name", label: "Owner" },
    { key: "created_at", label: "Created", format: (v) => formatDate(v as string | null) },
  ],
  customer: [
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "industry_label", label: "Industry" },
    { key: "source_label", label: "Source" },
    { key: "status_label", label: "Status" },
    { key: "owner_name", label: "Owner" },
    { key: "created_at", label: "Created", format: (v) => formatDate(v as string | null) },
  ],
  task: [
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
    { key: "due_at", label: "Due Date", format: (v) => formatDate(v as string | null) },
    { key: "assignee_name", label: "Assignee" },
    { key: "mode", label: "Mode" },
    { key: "created_at", label: "Created", format: (v) => formatDate(v as string | null) },
  ],
  activity: [
    { key: "body", label: "Description" },
    { key: "occurred_at", label: "Occurred At", format: (v) => formatDateTime(v as string | null) },
    { key: "user_name", label: "Performed By" },
    { key: "direction", label: "Direction" },
    { key: "activity_type_label", label: "Type" },
  ],
  user: [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "roles", label: "Roles" },
  ],
  contact: [
    { key: "full_name", label: "Full Name" },
    { key: "role", label: "Role" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "company_name", label: "Company" },
  ],
};

function getStatusBadge(type: string, detail: Record<string, unknown>) {
  if (type === "deal") {
    const terminalType = detail.terminal_type as string | null;
    if (terminalType === "won") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] h-4 px-1.5">Won</Badge>;
    if (terminalType === "lost") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] h-4 px-1.5">Lost</Badge>;
    return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] h-4 px-1.5">Open</Badge>;
  }
  if (type === "lead" || type === "customer") {
    const isTerminal = detail.is_terminal ?? detail.status;
    if (isTerminal) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] h-4 px-1.5">Closed</Badge>;
    return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] h-4 px-1.5">Open</Badge>;
  }
  if (type === "task") {
    const completedAt = detail.completed_at as string | null;
    if (completedAt) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] h-4 px-1.5">Completed</Badge>;
    return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] h-4 px-1.5">Open</Badge>;
  }
  return null;
}

export function RecordDetailsPanel({ entityType, entityId, fixedGraphData, onSelectNode }: RecordDetailsPanelProps) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "related" | "timeline">("overview");

  useEffect(() => {
    let cancelled = false;
    
    fetch(`/api/graph/record-details?type=${entityType}&id=${entityId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setDetail(data?.detail || null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const config = NODE_TYPE_CONFIG[entityType];

  const fields = DETAIL_FIELDS[entityType] || [];

  const relatedCounts = useMemo(() => {
    const counts: Record<string, { count: number; label: string; color: string; totalCount: number }> = {};
    if (fixedGraphData) {
      for (const [catKey, category] of Object.entries(fixedGraphData.categories)) {
        if (category.totalCount === 0) continue;
        const displayKey = catKey === "owner" ? "user" : catKey;
        const nConfig = NODE_TYPE_CONFIG[displayKey as keyof typeof NODE_TYPE_CONFIG];
        if (!counts[displayKey]) {
          counts[displayKey] = { count: 0, label: nConfig?.label || displayKey, color: nConfig?.color || "#6b7280", totalCount: 0 };
        }
        counts[displayKey].count += category.totalCount;
        counts[displayKey].totalCount += category.totalCount;
      }
    }
    return counts;
  }, [fixedGraphData]);

  const relatedNodesByType = useMemo(() => {
    const byType: Record<string, GraphNode[]> = {};
    if (fixedGraphData) {
      for (const [catKey, category] of Object.entries(fixedGraphData.categories)) {
        if (category.nodes.length === 0) continue;
        const displayKey = catKey === "owner" ? "user" : catKey;
        if (!byType[displayKey]) {
          byType[displayKey] = [];
        }
        byType[displayKey].push(...category.nodes);
      }
    }
    return byType;
  }, [fixedGraphData]);

  const statusBadge = detail ? getStatusBadge(entityType, detail) : null;

  const primaryLabel: string = String(detail?.name || detail?.full_name || detail?.title || detail?.body || entityId);
  const secondaryLabel = config?.label || entityType;

  const notes = detail?.notes as string | undefined;
  const body = detail?.body as string | undefined;

  const crmHref = CRM_HREF_MAP[entityType] || "/";

  const relatedRecordsList = useMemo(() => {
    return ORDERED_TYPES
      .filter((t) => relatedCounts[t])
      .map((t) => ({
        type: t,
        label: NODE_TYPE_CONFIG[t as keyof typeof NODE_TYPE_CONFIG]?.label || t,
        count: relatedCounts[t].count,
        totalCount: relatedCounts[t].totalCount,
        color: relatedCounts[t].color,
      }));
  }, [relatedCounts]);

  const totalRelated = relatedRecordsList.reduce((sum, item) => sum + item.count, 0);

  const handleRelatedClick = useCallback((node: GraphNode) => {
    if (!onSelectNode) return;
    onSelectNode({
      entityType: node.type,
      entityId: node.id,
      displayName: node.label,
      secondaryText: node.sublabel,
    });
  }, [onSelectNode]);

  const timelineItems = useMemo(() => {
    const items: Array<{ id: string; label: string; date?: string; type: string; color: string }> = [];
    if (fixedGraphData) {
      for (const category of Object.values(fixedGraphData.categories)) {
        for (const node of category.nodes) {
          const meta = node.metadata as Record<string, unknown> | undefined;
          let date: string | undefined;
          if (node.type === "task") {
            date = meta?.due_at as string | undefined;
          } else if (node.type === "activity") {
            date = meta?.occurred_at as string | undefined;
          } else if (node.type === "event") {
            date = meta?.timestamp as string | undefined;
          }
          items.push({
            id: `${node.type}:${node.id}`,
            label: node.label,
            date,
            type: node.type,
            color: node.color || NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG]?.color || "#6b7280",
          });
        }
      }
    }
    items.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return items.slice(0, 20);
  }, [fixedGraphData]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0B1120] border-l border-white/10 rounded-r-xl">
      <div className="shrink-0 space-y-2 border-b border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: config?.color || "#6b7280" }}
              />
              <h3 className="text-xs font-semibold truncate text-slate-100">{primaryLabel}</h3>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[10px] text-slate-400 capitalize">{secondaryLabel}</p>
              {statusBadge}
            </div>
          </div>
        </div>

        {loading && <p className="text-[10px] text-slate-500">Loading...</p>}

        {!loading && detail && (
          <div className="space-y-1">
            {fields.map((field) => {
              const value = detail[field.key];
              if (value === null || value === undefined || value === "") return null;
              const display = field.format ? field.format(value, detail) : String(value);
              return (
                <div key={field.key} className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-500 truncate">{field.label}</span>
                  <span className="text-[10px] font-medium text-slate-300 text-right truncate" title={display}>
                    {display}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white px-2" onClick={() => window.open(crmHref, "_blank")}>
            <ExternalLink className="mr-1 size-2.5" />
            View {secondaryLabel}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white px-2" onClick={() => window.open("/activities", "_blank")}>
            <Plus className="mr-1 size-2.5" />
            Activity
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white px-2" onClick={() => window.open("/tasks", "_blank")}>
            <Plus className="mr-1 size-2.5" />
            Task
          </Button>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-0.5 border-b border-white/10 p-1">
        <Button
          variant={activeTab === "overview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("overview")}
          className={`rounded-md h-6 text-[10px] px-2 flex-1 transition-colors ${
            activeTab === "overview"
              ? "bg-purple-500/15 text-purple-300 hover:text-purple-200"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Overview
        </Button>
        <Button
          variant={activeTab === "related" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("related")}
          className={`rounded-md h-6 text-[10px] px-2 flex-1 transition-colors ${
            activeTab === "related"
              ? "bg-purple-500/15 text-purple-300 hover:text-purple-200"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Related ({totalRelated})
        </Button>
        <Button
          variant={activeTab === "timeline" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("timeline")}
          className={`rounded-md h-6 text-[10px] px-2 flex-1 transition-colors ${
            activeTab === "timeline"
              ? "bg-purple-500/15 text-purple-300 hover:text-purple-200"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Timeline
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2.5 space-y-3">
          {activeTab === "overview" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Summary</p>
                {notes && (
                  <p className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{notes}</p>
                )}
                {body && !notes && (
                  <p className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{body.slice(0, 300)}</p>
                )}
                {!notes && !body && (
                  <p className="text-[11px] text-slate-500">No summary available.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Related Records</p>
                <div className="space-y-2">
                  {relatedRecordsList.length === 0 && (
                    <p className="text-[11px] text-slate-500">No related records found.</p>
                  )}
                  {relatedRecordsList.map((item) => {
                    const nodesForType = relatedNodesByType[item.type] || [];
                    return (
                      <div key={item.type} className="space-y-1">
                        <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#050A14] px-2 py-1">
                          <div className="flex items-center gap-2">
                            <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[11px] text-slate-300">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.totalCount > nodesForType.length && onSelectNode && nodesForType.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRelatedClick(nodesForType[0])}
                                className="text-[10px] text-purple-400 hover:text-purple-300"
                              >
                                View all
                              </button>
                            )}
                            <span className="text-[11px] font-medium text-slate-400">{item.count}</span>
                          </div>
                        </div>
                        {nodesForType.length > 0 && (
                          <div className="space-y-1 pl-2">
                            {nodesForType.slice(0, 4).map((node) => (
                              <button
                                key={`${node.type}:${node.id}`}
                                type="button"
                                onClick={() => handleRelatedClick(node)}
                                className="w-full flex items-center justify-between rounded-md border border-white/5 bg-[#050A14] px-2 py-1 text-start transition-colors hover:bg-white/5"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] text-slate-300 truncate block">{node.label}</span>
                                  {node.sublabel && (
                                    <span className="text-[10px] text-slate-500 truncate block">{node.sublabel}</span>
                                  )}
                                </div>
                                <div className="size-1.5 rounded-full shrink-0 ml-2" style={{ backgroundColor: node.color || NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG]?.color || "#6b7280" }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "related" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Related Records</p>
              <div className="space-y-2">
                {relatedRecordsList.length === 0 && (
                  <p className="text-[11px] text-slate-500">No related records found.</p>
                )}
                {relatedRecordsList.map((item) => {
                  const nodesForType = relatedNodesByType[item.type] || [];
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#050A14] px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-[11px] text-slate-300">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.totalCount > nodesForType.length && onSelectNode && nodesForType.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRelatedClick(nodesForType[0])}
                              className="text-[10px] text-purple-400 hover:text-purple-300"
                            >
                              View all
                            </button>
                          )}
                          <span className="text-[11px] font-medium text-slate-400">{item.count}</span>
                        </div>
                      </div>
                      {nodesForType.length > 0 && (
                        <div className="space-y-1 pl-2">
                          {nodesForType.map((node) => (
                            <button
                              key={`${node.type}:${node.id}`}
                              type="button"
                              onClick={() => handleRelatedClick(node)}
                              className="w-full flex items-center justify-between rounded-md border border-white/5 bg-[#050A14] px-2 py-1 text-start transition-colors hover:bg-white/5"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-[11px] text-slate-300 truncate block">{node.label}</span>
                                {node.sublabel && (
                                  <span className="text-[10px] text-slate-500 truncate block">{node.sublabel}</span>
                                )}
                              </div>
                              <div className="size-1.5 rounded-full shrink-0 ml-2" style={{ backgroundColor: node.color || NODE_TYPE_CONFIG[node.type as keyof typeof NODE_TYPE_CONFIG]?.color || "#6b7280" }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Timeline</p>
              <div className="space-y-1.5">
                {timelineItems.length === 0 && (
                  <p className="text-[11px] text-slate-500">No timeline events.</p>
                )}
                {timelineItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 rounded-md border border-white/10 bg-[#050A14] px-2 py-1.5">
                    <div className="size-1.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-300 truncate">{item.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 capitalize">{item.type}</span>
                        {item.date && (
                          <span className="text-[10px] text-slate-500">{item.date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 p-2">
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-[10px] hover:bg-white/5 hover:text-white text-slate-400"
            onClick={() => window.open(crmHref, "_blank")}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-[10px] hover:bg-white/5 hover:text-white text-slate-400"
            onClick={() => window.open("/tasks", "_blank")}
          >
            Task
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-[10px] hover:bg-white/5 hover:text-white text-slate-400"
          >
            More
          </Button>
        </div>
      </div>
    </div>
  );
}

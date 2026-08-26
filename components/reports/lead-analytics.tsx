"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { LeadBySource, LeadByStage, LeadConversionFunnel, TopSource } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { ChartTooltip } from "@/components/reports/chart-tooltip";
import { PieCellWithHover } from "@/components/reports/pie-cell-with-hover";
import { CHART_COLORS, PIE_CHART_COLORS } from "@/utils/chart-theme";

interface LeadAnalyticsProps {
  bySource: LeadBySource[];
  byStage: LeadByStage[];
  conversionFunnel: LeadConversionFunnel[];
  topSources: TopSource[];
}

export function LeadAnalytics({ bySource, byStage, conversionFunnel, topSources }: LeadAnalyticsProps) {
  const sourceData = bySource.map((s) => ({
    name: s.sourceLabel || "Unknown",
    count: s.count,
  }));

  const stageData = byStage.map((s) => ({
    name: s.stageLabel || "Unknown",
    count: s.count,
  }));

  const funnelData = conversionFunnel.map((f) => ({
    name: f.stageLabel || "Unknown",
    value: f.count,
    conversionRate: f.conversionRate,
  }));

  const topSourcesData = topSources.map((t) => ({
    name: t.sourceLabel || "Unknown",
    leads: t.leads,
    deals: t.deals,
    conversionRate: t.conversionRate,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Leads by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const p = typeof percent === "number" ? percent : 0;
                    return `${name}: ${(p * 100).toFixed(0)}%`;
                  }}
                   outerRadius={120}
                   fill={CHART_COLORS.blue}
                   dataKey="count"
                >
                  {sourceData.map((entry, index) => (
                    <PieCellWithHover
                      key={`cell-${index}`}
                      index={index}
                      colorIndex={index % PIE_CHART_COLORS.length}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={<ChartTooltip />}
                />
                 <Bar dataKey="count" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                <Tooltip
                  cursor={{ fill: "rgba(139, 92, 246, 0.1)" }}
                  content={
                    <ChartTooltip
                      formatter={(value, _name, props) => {
                        const payload = (props as unknown as { payload?: { conversionRate?: number } }).payload as { conversionRate?: number } | undefined;
                        const rate = payload?.conversionRate;
                        return [`${value} leads${rate != null ? ` (${rate}%)` : ""}`, "Count"];
                      }}
                    />
                  }
                />
                 <Bar dataKey="value" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSourcesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={
                    <ChartTooltip
                      formatter={(value, name) => [String(value), name ?? ""]}
                    />
                  }
                />
                 <Bar dataKey="leads" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Leads" />
                 <Bar dataKey="deals" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} name="Deals" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

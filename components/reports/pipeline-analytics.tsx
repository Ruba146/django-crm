"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { PipelineStageAnalytics, PipelineFunnel, WinLossAnalytics } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { ChartTooltip } from "@/components/reports/chart-tooltip";
import { PieCellWithHover } from "@/components/reports/pie-cell-with-hover";
import { CHART_COLORS, WIN_LOSS_COLORS } from "@/utils/chart-theme";

interface PipelineAnalyticsProps {
  byStage: PipelineStageAnalytics[];
  funnel: PipelineFunnel[];
  winLoss: WinLossAnalytics;
}

export function PipelineAnalytics({ byStage, funnel, winLoss }: PipelineAnalyticsProps) {
  const stageData = byStage.map((s) => ({
    name: s.stageLabel || "Untitled",
    deals: s.dealCount,
    value: s.totalValueMinor / 100,
  }));

  const funnelData = funnel.map((f) => ({
    name: f.stageLabel || "Untitled",
    value: f.count,
    conversionRate: f.conversionRate,
  }));

  const winLossData = [
    { name: "Won", value: winLoss.won, color: WIN_LOSS_COLORS.won },
    { name: "Lost", value: winLoss.lost, color: WIN_LOSS_COLORS.lost },
    { name: "Open", value: winLoss.open, color: WIN_LOSS_COLORS.open },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Deals by Stage</CardTitle>
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
                  content={<ChartTooltip formatter={(value) => [String(value), "Deals"]} />}
                />
                 <Bar dataKey="deals" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Funnel</CardTitle>
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
                        return [`${value} deals${rate != null ? ` (${rate}%)` : ""}`, "Count"];
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

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Win vs Lost</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const p = typeof percent === "number" ? percent : 0;
                    return `${name}: ${(p * 100).toFixed(0)}%`;
                  }}
                   outerRadius={120}
                   fill={CHART_COLORS.purple}
                   dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <PieCellWithHover
                      key={`cell-${index}`}
                      index={index}
                      colorIndex={index === 0 ? 1 : index === 1 ? 3 : 2}
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
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityByType, ActivityByUser, ActivityByMonth } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { ChartTooltip } from "@/components/reports/chart-tooltip";
import { PieCellWithHover } from "@/components/reports/pie-cell-with-hover";
import { CHART_COLORS, PIE_CHART_COLORS } from "@/utils/chart-theme";

interface ActivityAnalyticsProps {
  byType: ActivityByType[];
  byUser: ActivityByUser[];
  byMonth: ActivityByMonth[];
}

export function ActivityAnalytics({ byType, byUser, byMonth }: ActivityAnalyticsProps) {
  const typeData = byType.map((a) => ({
    name: a.activityTypeLabel || "Unknown",
    count: a.count,
  }));

  const userData = byUser.map((u) => ({
    name: u.userName || "Unknown",
    count: u.count,
  }));

  const monthData = byMonth.map((m) => ({
    month: m.month,
    count: m.count,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Activities by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
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
                  {typeData.map((entry, index) => (
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
          <CardTitle>Activities by User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(20, 184, 166, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="count" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Activities by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

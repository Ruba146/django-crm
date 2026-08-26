"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { RevenueByMonth, AverageDealSize, DealsByMonth } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ChartTooltip } from "@/components/reports/chart-tooltip";
import { CHART_COLORS } from "@/utils/chart-theme";

interface SalesAnalyticsProps {
  revenueByMonth: RevenueByMonth[];
  averageDealSize: AverageDealSize[];
  dealsByMonth: DealsByMonth[];
}

export function SalesAnalytics({ revenueByMonth, averageDealSize, dealsByMonth }: SalesAnalyticsProps) {
  const revenueData = revenueByMonth.map((r) => ({
    month: r.month,
    revenue: r.revenue / 100,
    deals: r.deals,
  }));

  const avgSizeData = averageDealSize.map((a) => ({
    month: a.month,
    average: a.average / 100,
  }));

  const dealsCreatedClosedData = dealsByMonth.map((d) => ({
    month: d.month,
    created: d.created,
    closed: d.closed,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.1)" }}
                  content={<ChartTooltip formatter={(value) => [`${Number(value).toFixed(2)} SAR`, "Revenue"]} />}
                />
                 <Bar dataKey="revenue" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Deal Size</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={avgSizeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ stroke: CHART_COLORS.blue, strokeWidth: 2 }}
                  content={<ChartTooltip formatter={(value) => [`${Number(value).toFixed(2)} SAR`, "Avg Deal"]} />}
                />
                <Line type="monotone" dataKey="average" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: CHART_COLORS.blueDark, stroke: "#ffffff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deals Created by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dealsCreatedClosedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="created" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Created" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deals Closed by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dealsCreatedClosedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="closed" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} name="Closed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

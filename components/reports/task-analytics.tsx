"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { TaskByStatus, TaskByType, TaskByUser, OverdueTask } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { ChartTooltip } from "@/components/reports/chart-tooltip";
import { PieCellWithHover } from "@/components/reports/pie-cell-with-hover";
import { CHART_COLORS } from "@/utils/chart-theme";

interface TaskAnalyticsProps {
  byStatus: TaskByStatus[];
  byType: TaskByType[];
  byUser: TaskByUser[];
  overdue: OverdueTask[];
}

export function TaskAnalytics({ byStatus, byType, byUser, overdue }: TaskAnalyticsProps) {
  const statusData = byStatus.map((t) => ({
    name: t.status === "open" ? "Open" : "Completed",
    value: t.count,
    colorIndex: t.status === "open" ? 2 : 1,
  }));

  const typeData = byType.map((t) => ({
    name: t.taskTypeLabel || "Unknown",
    count: t.count,
  }));

  const userData = byUser.map((u) => ({
    name: u.userName || "Unknown",
    open: u.open,
    completed: u.completed,
  }));

  const overdueData = overdue.map((o) => ({
    id: o.id,
    title: o.title || "Untitled",
    due_at: o.due_at || "",
    assigneeName: o.assigneeName || "Unassigned",
    daysOverdue: o.daysOverdue,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tasks by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const p = typeof percent === "number" ? percent : 0;
                    return `${name}: ${(p * 100).toFixed(0)}%`;
                  }}
                   outerRadius={120}
                   fill={CHART_COLORS.blue}
                   dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <PieCellWithHover
                      key={`cell-${index}`}
                      index={index}
                      colorIndex={entry.colorIndex}
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
          <CardTitle>Tasks by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks by User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="open" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} name="Open" />
                <Bar dataKey="completed" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overdue Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {overdueData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue tasks.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {overdueData.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.assigneeName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-danger">{task.daysOverdue} days</p>
                    <p className="text-xs text-muted-foreground">Due: {task.due_at}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

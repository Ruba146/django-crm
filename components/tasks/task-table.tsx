"use client";

import { Clock } from "lucide-react";
import {
  Avatar,
  Badge,
  DataTable,
  Pagination,
  type Column,
  type SortConfig,
} from "@/components/ui";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { TaskListItem } from "@/types";
import type { TaskColumns } from "./task-toolbar";

/**
 * Task list table — renders the enriched task rows using the reusable
 * DataTable. The entire row is clickable and opens the task detail modal.
 * Presentational; sorting/pagination are controlled by the parent via props.
 */
export function TaskTable({
  tasks,
  columns,
  sort,
  onSortChange,
  page,
  totalPages,
  onPageChange,
  selectedId,
  onSelect,
  emptyState,
}: {
  tasks: TaskListItem[];
  columns: TaskColumns;
  sort: SortConfig | null;
  onSortChange: (columnId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyState?: { title: string; description?: string } | null;
}) {
  const colorText = (color: string | null) =>
    color ? { borderColor: color, color } : undefined;

  const allColumns: Column<TaskListItem>[] = [
    {
      id: "title",
      header: "Task Title",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title ?? "—"}</p>
            {row.description && (
              <p className="truncate text-xs text-muted-foreground">
                {row.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "relatedRecord",
      header: "Related Record",
      hideOnMobile: true,
      cell: (row) => (
        <span className="truncate">{row.relatedRecordName ?? "—"}</span>
      ),
    },
    {
      id: "company",
      header: "Company",
      hideOnMobile: true,
      cell: (row) => (
        <span className="truncate">{row.companyName ?? "—"}</span>
      ),
    },
    {
      id: "assignee",
      header: "Assignee",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={row.assigneeName ?? "?"} size="xs" />
          <span className="truncate">{row.assigneeName ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "taskType",
      header: "Task Type",
      hideOnMobile: true,
      cell: (row) =>
        row.taskTypeLabel ? (
          <Badge variant="outline" style={colorText(row.taskTypeColor)}>
            {row.taskTypeLabel}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "is_ai_copy",
      header: "AI Copy",
      hideOnMobile: true,
      cell: (row) =>
        row.isAiCopy ? (
          <Badge variant="neutral" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            AI
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "dueDate",
      header: "Due Date",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <time dateTime={row.due_at ?? undefined} className="text-muted-foreground">
          {row.due_at ? formatDate(row.due_at) : "—"}
        </time>
      ),
    },
    {
      id: "status",
      header: "Status",
      hideOnMobile: true,
      cell: (row) => {
        const isCompleted = row.status === "completed";
        return (
          <Badge variant={isCompleted ? "success" : "warning"}>
            {isCompleted ? "Completed" : "Open"}
          </Badge>
        );
      },
    },
    {
      id: "completedDate",
      header: "Completed Date",
      hideOnMobile: true,
      cell: (row) => (
        <time dateTime={row.completed_at ?? undefined} className="text-muted-foreground">
          {row.completed_at ? formatDate(row.completed_at) : "—"}
        </time>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <time dateTime={row.created_at ?? undefined} className="text-muted-foreground">
          {formatDate(row.created_at)}
        </time>
      ),
    },
  ];

  const visibleColumns = allColumns.filter(
    (c) => columns[c.id as keyof TaskColumns] !== false
  );

  return (
    <DataTable<TaskListItem>
      columns={visibleColumns}
      data={tasks}
      rowKey={(row) => row.id}
      sort={sort}
      onSortChange={onSortChange}
      emptyState={
        emptyState
          ? { title: emptyState.title, description: emptyState.description }
          : null
      }
      footer={
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">{tasks.length} shown</p>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      }
      onRowClick={(row) => onSelect(row.id)}
      className={cn(selectedId && "ring-1 ring-primary-200")}
    />
  );
}

"use client";

import { History } from "lucide-react";
import {
  Avatar,
  Badge,
  DataTable,
  Pagination,
  type Column,
  type SortConfig,
} from "@/components/ui";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { ActivityRecord } from "@/types";
import type { ActivityColumns } from "./activity-toolbar";
import { ENTITY_TYPE_LABELS } from "./activity-filters";

/**
 * Activity records table — renders ONE row per record (Lead / Customer /
 * Deal) that has activity history, using the reusable DataTable. It never
 * repeats a row per activity. The entire row is clickable and loads the
 * record's timeline on demand. Presentational + row interactions;
 * sorting/pagination are controlled by the parent via props.
 */
export function ActivityTable({
  records,
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
  records: ActivityRecord[];
  columns: ActivityColumns;
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

  const allColumns: Column<ActivityRecord>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name ?? "—"}</p>
            {row.company && (
              <p className="truncate text-xs text-muted-foreground">
                {row.company}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "company",
      header: "Company",
      hideOnMobile: true,
      cell: (row) => <span className="truncate">{row.company ?? "—"}</span>,
    },
    {
      id: "owner",
      header: "Owner",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={row.ownerName ?? "?"} size="xs" />
          <span className="truncate">{row.ownerName ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "last_activity",
      header: "Last Activity",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <time
          dateTime={row.last_activity_at ?? undefined}
          className="inline-flex items-center gap-1.5 text-muted-foreground"
        >
          <History className="size-3.5 shrink-0" aria-hidden="true" />
          {row.last_activity_at ? formatDateTime(row.last_activity_at) : "—"}
        </time>
      ),
    },
    {
      id: "activity_count",
      header: "Activity Count",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => {
        const badge =
          row.activity_count > 0
            ? row.activity_count >= 50
              ? "text-success"
              : row.activity_count >= 10
                ? "text-warning"
                : "text-primary"
            : "text-muted-foreground";
        return (
          <span className={`inline-flex items-center gap-1.5 tabular-nums ${badge}`}>
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {row.activity_count}
          </span>
        );
      },
    },
    {
      id: "stage",
      header: "Current Stage",
      hideOnMobile: true,
      cell: (row) =>
        row.stage ? (
          <Badge variant="outline" style={colorText(row.stage.color)}>
            {row.stage.label}
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
      id: "entity_type",
      header: "Entity Type",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground">
          {ENTITY_TYPE_LABELS[row.entity_type] ?? row.entity_type ?? "—"}
        </span>
      ),
    },
  ];

  const visibleColumns = allColumns.filter(
    (c) => columns[c.id as keyof ActivityColumns] !== false
  );

  return (
    <DataTable<ActivityRecord>
      columns={visibleColumns}
      data={records}
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
          <p className="text-xs text-muted-foreground">{records.length} shown</p>
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

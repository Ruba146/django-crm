"use client";

import { Building2, User } from "lucide-react";
import {
  Avatar,
  Badge,
  DataTable,
  Pagination,
  type Column,
  type SortConfig,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { DealListItem } from "@/types";
import type { DealColumns } from "./deal-toolbar";

/**
 * Deal list table — renders the enriched deal rows using the reusable
 * DataTable. The entire row is clickable and opens the deal detail modal.
 * Presentational; sorting/pagination are controlled by the parent via props.
 */
export function DealTable({
  deals,
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
  deals: DealListItem[];
  columns: DealColumns;
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

  const allColumns: Column<DealListItem>[] = [
    {
      id: "name",
      header: "Deal Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name ?? "—"}</p>
            {row.ownerName && (
              <p className="truncate text-xs text-muted-foreground">
                {row.ownerName}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{row.company ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "lead",
      header: "Lead",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{row.leadName ?? "—"}</span>
        </span>
      ),
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
      id: "stage",
      header: "Stage",
      hideOnMobile: true,
      cell: (row) => (
        <Badge variant="outline" style={colorText(row.stage?.color ?? null)}>
          {row.stage?.label ?? "—"}
        </Badge>
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
      id: "expected_value",
      header: "Expected Value",
      hideOnMobile: true,
      cell: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(
            row.expected_value_minor,
            row.currency_code ?? undefined,
            "en"
          )}
        </span>
      ),
    },
    {
      id: "probability",
      header: "Probability",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.probability_pct != null ? `${row.probability_pct}%` : "—"}
        </span>
      ),
    },
    {
      id: "target_close_date",
      header: "Target Close",
      hideOnMobile: true,
      cell: (row) => (
        <time
          dateTime={row.target_close_date ?? undefined}
          className="text-muted-foreground"
        >
          {formatDate(row.target_close_date)}
        </time>
      ),
    },
    {
      id: "created_at",
      header: "Created",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <time dateTime={row.created_at ?? undefined} className="text-muted-foreground">
          {formatDate(row.created_at)}
        </time>
      ),
    },
    {
      id: "status",
      header: "Status",
      hideOnMobile: true,
      cell: (row) => (
        <Badge
          variant="outline"
          style={colorText(row.stage?.color ?? null)}
        >
          {row.status ? row.status.toUpperCase() : "Open"}
        </Badge>
      ),
    },
  ];

  const visibleColumns = allColumns.filter(
    (c) => columns[c.id as keyof DealColumns] !== false
  );

  return (
    <DataTable<DealListItem>
      columns={visibleColumns}
      data={deals}
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
          <p className="text-xs text-muted-foreground">{deals.length} shown</p>
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

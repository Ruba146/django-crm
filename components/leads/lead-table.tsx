"use client";

import { Mail, Phone } from "lucide-react";
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
import type { LeadListItem } from "@/types";
import type { LeadColumns } from "./lead-toolbar";

/**
 * Lead list table — renders the enriched lead rows using the reusable
 * DataTable. The entire row is clickable and opens the lead detail modal.
 * Presentational; sorting/pagination are controlled by the parent via props.
 */
export function LeadTable({
  leads,
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
  leads: LeadListItem[];
  columns: LeadColumns;
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

  const allColumns: Column<LeadListItem>[] = [
    {
      id: "name",
      header: "Lead Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.full_name ?? "—"}</p>
            {row.phone && (
              <p className="truncate text-xs text-muted-foreground">{row.phone}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "company",
      header: "Company",
      cell: (row) => (
        <span className="truncate">{row.company ?? "—"}</span>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{row.phone ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{row.email ?? "—"}</span>
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
      id: "source",
      header: "Source",
      hideOnMobile: true,
      cell: (row) => (
        <Badge variant="outline" style={colorText(row.source?.color ?? null)}>
          {row.source?.label ?? "—"}
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
      id: "last_activity",
      header: "Last Activity",
      hideOnMobile: true,
      cell: (row) => (
        <time
          dateTime={row.last_activity_at ?? undefined}
          className="text-muted-foreground"
        >
          {row.last_activity_at ? formatDate(row.last_activity_at) : "—"}
        </time>
      ),
    },
    {
      id: "status",
      header: "Status",
      hideOnMobile: true,
      cell: (row) =>
        row.status ? (
          <Badge variant="outline" style={colorText(row.status.color)}>
            {row.status.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Active</span>
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
  ];

  const visibleColumns = allColumns.filter(
    (c) => columns[c.id as keyof LeadColumns] !== false
  );

  return (
    <DataTable<LeadListItem>
      columns={visibleColumns}
      data={leads}
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
          <p className="text-xs text-muted-foreground">
            {leads.length} shown
          </p>
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

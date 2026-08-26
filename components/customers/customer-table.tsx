"use client";

import { MoreHorizontal, Package } from "lucide-react";
import {
  Avatar,
  Badge,
  DataTable,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  Pagination,
  type Column,
  type SortConfig,
} from "@/components/ui";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { CustomerListItem } from "@/types";

/**
 * Customer list table — renders the enriched customer rows using the
 * reusable DataTable. Presentational + row interactions (selection, menu).
 * Sorting/pagination are controlled by the parent via props.
 */
export function CustomerTable({
  customers,
  sort,
  onSortChange,
  page,
  totalPages,
  onPageChange,
  selectedId,
  onSelect,
  emptyState,
  onGeneratePackage,
}: {
  customers: CustomerListItem[];
  sort: SortConfig | null;
  onSortChange: (columnId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyState?: { title: string; description?: string } | null;
  onGeneratePackage?: (id: string) => void;
}) {
  const colorText = (color: string | null) =>
    color ? { borderColor: color, color } : undefined;

  const columns: Column<CustomerListItem>[] = [
    {
      id: "name",
      header: "Customer",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name ?? "?"} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name ?? "—"}</p>
            {row.city && (
              <p className="truncate text-xs text-muted-foreground">{row.city}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "primaryContact",
      header: "Primary Contact",
      hideOnMobile: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.primaryContact?.name ?? "—"}</p>
          {row.primaryContact?.email && (
            <p className="truncate text-xs text-muted-foreground">
              {row.primaryContact.email}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "industry",
      header: "Industry",
      hideOnMobile: true,
      cell: (row) => (
        <Badge variant="outline" style={colorText(row.industry?.color ?? null)}>
          {row.industry?.label ?? "—"}
        </Badge>
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
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" style={colorText(row.status?.color ?? null)}>
          {row.status?.label ?? "—"}
        </Badge>
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
  ];

  return (
    <DataTable<CustomerListItem>
      columns={columns}
      data={customers}
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
            {customers.length} shown
          </p>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      }
      actions={(row) => (
        <Dropdown>
          <DropdownTrigger
            aria-label={`Actions for ${row.name ?? "customer"}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem onClick={() => onSelect(row.id)}>
              View details
            </DropdownItem>
            <DropdownItem onClick={() => onSelect(row.id)}>
              Open deals
            </DropdownItem>
            {onGeneratePackage && (
              <DropdownItem onClick={() => onGeneratePackage(row.id)}>
                <Package className="mr-2 size-4" aria-hidden="true" />
                Generate Package
              </DropdownItem>
            )}
          </DropdownContent>
        </Dropdown>
      )}
      className={cn(selectedId && "ring-1 ring-primary-200")}
    />
  );
}

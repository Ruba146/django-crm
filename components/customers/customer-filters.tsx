"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button, Select } from "@/components/ui";
import type { CustomerFilterOptions } from "@/types";

export interface CustomerFiltersState {
  industryId: string;
  sourceId: string;
  ownerId: string;
  statusId: string;
}

export const EMPTY_FILTERS: CustomerFiltersState = {
  industryId: "",
  sourceId: "",
  ownerId: "",
  statusId: "",
};

/**
 * Customer filter bar — industry, source, owner and status selects fed by
 * live filter options. Client component: reads/writes filter state only.
 */
export function CustomerFilters({
  options,
  filters,
  onChange,
}: {
  options: CustomerFilterOptions;
  filters: CustomerFiltersState;
  onChange: (filters: CustomerFiltersState) => void;
}) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const set = (key: keyof CustomerFiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <Select
        aria-label="Filter by industry"
        value={filters.industryId}
        onChange={(e) => set("industryId", e.target.value)}
        options={[
          { value: "", label: "All industries" },
          ...options.industries.map((i) => ({
            value: i.id ?? "",
            label: i.label ?? "",
          })),
        ]}
        className="w-44"
      />

      <Select
        aria-label="Filter by source"
        value={filters.sourceId}
        onChange={(e) => set("sourceId", e.target.value)}
        options={[
          { value: "", label: "All sources" },
          ...options.sources.map((s) => ({
            value: s.id ?? "",
            label: s.label ?? "",
          })),
        ]}
        className="w-40"
      />

      <Select
        aria-label="Filter by owner"
        value={filters.ownerId}
        onChange={(e) => set("ownerId", e.target.value)}
        options={[
          { value: "", label: "All owners" },
          ...options.owners.map((o) => ({
            value: o.id,
            label: o.name,
          })),
        ]}
        className="w-44"
      />

      <Select
        aria-label="Filter by status"
        value={filters.statusId}
        onChange={(e) => set("statusId", e.target.value)}
        options={[
          { value: "", label: "All statuses" },
          ...options.statuses.map((s) => ({
            value: s.id ?? "",
            label: s.label ?? "",
          })),
        ]}
        className="w-40"
      />

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_FILTERS)}
          aria-label="Clear filters"
        >
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>
      )}
    </div>
  );
}

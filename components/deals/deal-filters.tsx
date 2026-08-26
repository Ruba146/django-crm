"use client";

import { CalendarRange, SlidersHorizontal, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { DealFilterOptions } from "@/types";

export interface DealFiltersState {
  ownerId: string;
  stageId: string;
  statusId: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_FILTERS: DealFiltersState = {
  ownerId: "",
  stageId: "",
  statusId: "",
  createdFrom: "",
  createdTo: "",
};

/**
 * Deal filter bar — owner, stage, status and created-date selects fed by
 * live filter options. Client component: reads/writes filter state only.
 */
export function DealFilters({
  options,
  filters,
  onChange,
}: {
  options: DealFilterOptions;
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
}) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const set = (key: keyof DealFiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">Filters</span>
      </div>

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
        aria-label="Filter by stage"
        value={filters.stageId}
        onChange={(e) => set("stageId", e.target.value)}
        options={[
          { value: "", label: "All stages" },
          ...options.stages.map((s) => ({
            value: s.id ?? "",
            label: s.label ?? "",
          })),
        ]}
        className="w-40"
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

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden="true">
          <CalendarRange className="size-4" />
        </span>
        <Input
          type="date"
          aria-label="Created from"
          value={filters.createdFrom}
          onChange={(e) => set("createdFrom", e.target.value)}
          className="w-40"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          aria-label="Created to"
          value={filters.createdTo}
          onChange={(e) => set("createdTo", e.target.value)}
          className="w-40"
        />
      </div>

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

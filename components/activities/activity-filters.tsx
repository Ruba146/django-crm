"use client";

import { CalendarRange, SlidersHorizontal, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { ActivityFilterOptions } from "@/types";

export interface ActivityFiltersState {
  activityTypeId: string;
  userId: string;
  entityType: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: ActivityFiltersState = {
  activityTypeId: "",
  userId: "",
  entityType: "",
  dateFrom: "",
  dateTo: "",
};

/** Human-readable labels for known entity types. */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  deal: "Deal",
  establishment: "Customer",
};

/**
 * Activity filter bar — activity type, user, entity type and date-range
 * selects fed by live filter options. Client component: reads/writes filter
 * state only.
 */
export function ActivityFilters({
  options,
  filters,
  onChange,
}: {
  options: ActivityFilterOptions;
  filters: ActivityFiltersState;
  onChange: (filters: ActivityFiltersState) => void;
}) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const set = (key: keyof ActivityFiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <Select
        aria-label="Filter by activity type"
        value={filters.activityTypeId}
        onChange={(e) => set("activityTypeId", e.target.value)}
        options={[
          { value: "", label: "All activity types" },
          ...options.activityTypes.map((t) => ({
            value: t.id ?? "",
            label: t.label ?? "",
          })),
        ]}
        className="w-44"
      />

      <Select
        aria-label="Filter by user"
        value={filters.userId}
        onChange={(e) => set("userId", e.target.value)}
        options={[
          { value: "", label: "All users" },
          ...options.users.map((o) => ({
            value: o.id,
            label: o.name,
          })),
        ]}
        className="w-40"
      />

      <Select
        aria-label="Filter by entity type"
        value={filters.entityType}
        onChange={(e) => set("entityType", e.target.value)}
        options={[
          { value: "", label: "All entity types" },
          ...options.entityTypes.map((et) => ({
            value: et,
            label: ENTITY_TYPE_LABELS[et] ?? et,
          })),
        ]}
        className="w-44"
      />

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden="true">
          <CalendarRange className="size-4" />
        </span>
        <Input
          type="date"
          aria-label="Date from"
          value={filters.dateFrom}
          onChange={(e) => set("dateFrom", e.target.value)}
          className="w-40"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          aria-label="Date to"
          value={filters.dateTo}
          onChange={(e) => set("dateTo", e.target.value)}
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

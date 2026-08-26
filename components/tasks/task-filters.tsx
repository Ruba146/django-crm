"use client";

import { CalendarRange, SlidersHorizontal, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { TaskFilterOptions } from "@/types";

export interface TaskFiltersState {
  assigneeId: string;
  taskTypeId: string;
  entityType: string;
  dueFrom: string;
  dueTo: string;
}

export const EMPTY_FILTERS: TaskFiltersState = {
  assigneeId: "",
  taskTypeId: "",
  entityType: "",
  dueFrom: "",
  dueTo: "",
};

/**
 * Task filter bar — assignee, task type, entity type and due-date selects
 * fed by live filter options. Client component: reads/writes filter state only.
 */
export function TaskFilters({
  options,
  filters,
  onChange,
}: {
  options: TaskFilterOptions;
  filters: TaskFiltersState;
  onChange: (filters: TaskFiltersState) => void;
}) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const set = (key: keyof TaskFiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <Select
        aria-label="Filter by assignee"
        value={filters.assigneeId}
        onChange={(e) => set("assigneeId", e.target.value)}
        options={[
          { value: "", label: "All assignees" },
          ...options.assignees.map((o) => ({
            value: o.id,
            label: o.name,
          })),
        ]}
        className="w-44"
      />

      <Select
        aria-label="Filter by task type"
        value={filters.taskTypeId}
        onChange={(e) => set("taskTypeId", e.target.value)}
        options={[
          { value: "", label: "All task types" },
          ...options.taskTypes.map((t) => ({
            value: t.id ?? "",
            label: t.label ?? "",
          })),
        ]}
        className="w-44"
      />

      <Select
        aria-label="Filter by entity type"
        value={filters.entityType}
        onChange={(e) => set("entityType", e.target.value)}
        options={[
          { value: "", label: "All entity types" },
          ...options.entityTypes.map((et) => ({
            value: et,
            label: et,
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
          aria-label="Due from"
          value={filters.dueFrom}
          onChange={(e) => set("dueFrom", e.target.value)}
          className="w-40"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          aria-label="Due to"
          value={filters.dueTo}
          onChange={(e) => set("dueTo", e.target.value)}
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

"use client";

import { Columns3 } from "lucide-react";
import {
  Checkbox,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  SearchInput,
} from "@/components/ui";

export interface ActivityColumns {
  name: boolean;
  company: boolean;
  owner: boolean;
  last_activity: boolean;
  activity_count: boolean;
  stage: boolean;
  entity_type: boolean;
}

export const DEFAULT_COLUMNS: ActivityColumns = {
  name: true,
  company: true,
  owner: true,
  last_activity: true,
  activity_count: true,
  stage: true,
  entity_type: true,
};

const COLUMN_LABELS: { key: keyof ActivityColumns; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "owner", label: "Owner" },
  { key: "last_activity", label: "Last Activity" },
  { key: "activity_count", label: "Activity Count" },
  { key: "stage", label: "Current Stage" },
  { key: "entity_type", label: "Entity Type" },
];

/**
 * Activity toolbar — search input + column visibility dropdown.
 * Client component; purely presentational state handling.
 */
export function ActivityToolbar({
  query,
  onQueryChange,
  columns,
  onColumnsChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  columns: ActivityColumns;
  onColumnsChange: (columns: ActivityColumns) => void;
}) {
  const toggleColumn = (key: keyof ActivityColumns) => {
    // The "Name" column is always required.
    if (key === "name") return;
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search records…"
        className="max-w-xs"
        aria-label="Search records"
      />

      <Dropdown>
        <DropdownTrigger
          aria-label="Toggle columns"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Columns3 className="size-4" aria-hidden="true" />
          Columns
        </DropdownTrigger>
        <DropdownContent align="end">
          {COLUMN_LABELS.map((col) => (
            <DropdownItem
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className="cursor-pointer"
            >
              <Checkbox
                checked={columns[col.key]}
                disabled={col.key === "name"}
                aria-label={col.label}
                onChange={() => {}}
              />
              <span>{col.label}</span>
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem
            onClick={() => onColumnsChange(DEFAULT_COLUMNS)}
            className="cursor-pointer"
          >
            Reset columns
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  );
}

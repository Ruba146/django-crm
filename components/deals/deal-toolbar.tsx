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

export interface DealColumns {
  name: boolean;
  company: boolean;
  lead: boolean;
  owner: boolean;
  stage: boolean;
  expected_value: boolean;
  probability: boolean;
  target_close_date: boolean;
  created_at: boolean;
  status: boolean;
}

export const DEFAULT_COLUMNS: DealColumns = {
  name: true,
  company: true,
  lead: true,
  owner: true,
  stage: true,
  expected_value: true,
  probability: true,
  target_close_date: true,
  created_at: true,
  status: true,
};

const COLUMN_LABELS: { key: keyof DealColumns; label: string }[] = [
  { key: "name", label: "Deal Name" },
  { key: "company", label: "Company" },
  { key: "lead", label: "Lead" },
  { key: "owner", label: "Owner" },
  { key: "stage", label: "Stage" },
  { key: "expected_value", label: "Expected Value" },
  { key: "probability", label: "Probability" },
  { key: "target_close_date", label: "Target Close Date" },
  { key: "created_at", label: "Created" },
  { key: "status", label: "Status" },
];

/**
 * Deal toolbar — search input + column visibility dropdown.
 * Client component; purely presentational state handling.
 */
export function DealToolbar({
  query,
  onQueryChange,
  columns,
  onColumnsChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  columns: DealColumns;
  onColumnsChange: (columns: DealColumns) => void;
}) {
  const toggleColumn = (key: keyof DealColumns) => {
    // The "Deal Name" column is always required.
    if (key === "name") return;
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search deals…"
        className="max-w-xs"
        aria-label="Search deals"
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

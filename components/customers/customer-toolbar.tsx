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

export interface CustomerColumns {
  name: boolean;
  primaryContact: boolean;
  industry: boolean;
  source: boolean;
  status: boolean;
  owner: boolean;
  created_at: boolean;
}

export const DEFAULT_COLUMNS: CustomerColumns = {
  name: true,
  primaryContact: true,
  industry: true,
  source: true,
  status: true,
  owner: true,
  created_at: true,
};

const COLUMN_LABELS: { key: keyof CustomerColumns; label: string }[] = [
  { key: "name", label: "Customer" },
  { key: "primaryContact", label: "Primary Contact" },
  { key: "industry", label: "Industry" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "created_at", label: "Created" },
];

/**
 * Customer toolbar — search input + column visibility dropdown.
 * Client component; purely presentational state handling.
 */
export function CustomerToolbar({
  query,
  onQueryChange,
  columns,
  onColumnsChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  columns: CustomerColumns;
  onColumnsChange: (columns: CustomerColumns) => void;
}) {
  const toggleColumn = (key: keyof CustomerColumns) => {
    // The "Customer" column is always required.
    if (key === "name") return;
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search customers…"
        className="max-w-xs"
        aria-label="Search customers"
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

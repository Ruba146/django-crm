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

export interface LeadColumns {
  name: boolean;
  company: boolean;
  phone: boolean;
  email: boolean;
  owner: boolean;
  source: boolean;
  stage: boolean;
  created_at: boolean;
  last_activity: boolean;
  status: boolean;
  probability: boolean;
}

export const DEFAULT_COLUMNS: LeadColumns = {
  name: true,
  company: true,
  phone: true,
  email: true,
  owner: true,
  source: true,
  stage: true,
  created_at: true,
  last_activity: true,
  status: true,
  probability: true,
};

const COLUMN_LABELS: { key: keyof LeadColumns; label: string }[] = [
  { key: "name", label: "Lead Name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "owner", label: "Owner" },
  { key: "source", label: "Source" },
  { key: "stage", label: "Stage" },
  { key: "created_at", label: "Created" },
  { key: "last_activity", label: "Last Activity" },
  { key: "status", label: "Status" },
  { key: "probability", label: "Probability" },
];

/**
 * Lead toolbar — search input + column visibility dropdown.
 * Client component; purely presentational state handling.
 */
export function LeadToolbar({
  query,
  onQueryChange,
  columns,
  onColumnsChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  columns: LeadColumns;
  onColumnsChange: (columns: LeadColumns) => void;
}) {
  const toggleColumn = (key: keyof LeadColumns) => {
    // The "Lead Name" column is always required.
    if (key === "name") return;
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search leads…"
        className="max-w-xs"
        aria-label="Search leads"
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

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

export interface TaskColumns {
  title: boolean;
  relatedRecord: boolean;
  company: boolean;
  assignee: boolean;
  taskType: boolean;
  dueDate: boolean;
  status: boolean;
  completedDate: boolean;
  createdAt: boolean;
}

export const DEFAULT_COLUMNS: TaskColumns = {
  title: true,
  relatedRecord: true,
  company: true,
  assignee: true,
  taskType: true,
  dueDate: true,
  status: true,
  completedDate: true,
  createdAt: true,
};

const COLUMN_LABELS: { key: keyof TaskColumns; label: string }[] = [
  { key: "title", label: "Task Title" },
  { key: "relatedRecord", label: "Related Record" },
  { key: "company", label: "Company" },
  { key: "assignee", label: "Assignee" },
  { key: "taskType", label: "Task Type" },
  { key: "dueDate", label: "Due Date" },
  { key: "status", label: "Status" },
  { key: "completedDate", label: "Completed Date" },
  { key: "createdAt", label: "Created" },
];

/**
 * Task toolbar — search input + column visibility dropdown.
 * Client component; purely presentational state handling.
 */
export function TaskToolbar({
  query,
  onQueryChange,
  columns,
  onColumnsChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  columns: TaskColumns;
  onColumnsChange: (columns: TaskColumns) => void;
}) {
  const toggleColumn = (key: keyof TaskColumns) => {
    if (key === "title") return;
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search tasks…"
        className="max-w-xs"
        aria-label="Search tasks"
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
                disabled={col.key === "title"}
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

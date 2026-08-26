"use client";

import { useCallback, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  /** Column id used to sort by. */
  columnId: string;
  direction: SortDirection;
}

export interface UseTableSortingOptions<T> {
  /** Initial sort applied on mount. */
  initialSort?: SortState;
  /**
   * Optional accessor to extract a sortable value from a row for a column.
   * Falls back to `row[columnId]` when not provided.
   */
  getSortValue?: (item: T, columnId: string) => unknown;
}

export interface UseTableSortingResult<T> {
  /** Current sort state (or null when unsorted). */
  sort: SortState | null;
  /** Set the sort state explicitly. */
  setSort: (sort: SortState | null) => void;
  /** Toggle a column between asc/desc, or set it as the active column. */
  toggleSort: (columnId: string) => void;
  /** Clear the current sort. */
  clearSort: () => void;
  /** The input data sorted according to the current sort state. */
  sortedData: T[];
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  return aStr.localeCompare(bStr);
}

/**
 * Generic, framework-agnostic sorting hook for tabular data.
 *
 * The hook owns the sort state and returns the sorted array. It has zero
 * knowledge of any CRM domain — it simply sorts an array of `T` by a column.
 */
export function useTableSorting<T>(
  data: T[],
  options?: UseTableSortingOptions<T>
): UseTableSortingResult<T> {
  const [sort, setSort] = useState<SortState | null>(
    options?.initialSort ?? null
  );

  const toggleSort = useCallback(
    (columnId: string) => {
      setSort((current) => {
        if (!current || current.columnId !== columnId) {
          return { columnId, direction: "asc" };
        }
        return current.direction === "asc"
          ? { columnId, direction: "desc" }
          : null;
      });
    },
    []
  );

  const clearSort = useCallback(() => setSort(null), []);

  const getSortValue = options?.getSortValue;

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const getValue = getSortValue;
    const { columnId, direction } = sort;
    const factor = direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      const aVal = getValue ? getValue(a, columnId) : (a as Record<string, unknown>)[columnId];
      const bVal = getValue ? getValue(b, columnId) : (b as Record<string, unknown>)[columnId];
      return compareValues(aVal, bVal) * factor;
    });
  }, [data, sort, getSortValue]);

  return { sort, setSort, toggleSort, clearSort, sortedData };
}

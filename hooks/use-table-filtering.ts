"use client";

import { useCallback, useMemo, useState } from "react";

export interface UseTableFilteringOptions<T> {
  /**
   * Keys whose values are searched when a query is typed.
   * Ignored when `getSearchText` is provided.
   */
  searchKeys?: (keyof T)[];
  /** Custom accessor that returns the searchable text for a row. */
  getSearchText?: (item: T) => string;
  /** Initial query value. */
  initialQuery?: string;
}

export interface UseTableFilteringResult<T> {
  /** Current search/query string. */
  query: string;
  /** Set the query (used by a SearchInput or similar). */
  setQuery: (query: string) => void;
  /** Clear the query. */
  clearQuery: () => void;
  /** The data filtered by the current query. */
  filteredData: T[];
}

/**
 * Generic, framework-agnostic filtering hook for tabular data.
 *
 * Filters an array of `T` by a text query across one or more keys. When
 * neither `searchKeys` nor `getSearchText` is provided, it falls back to
 * searching every string-compatible value on the row.
 */
export function useTableFiltering<T>(
  data: T[],
  options?: UseTableFilteringOptions<T>
): UseTableFilteringResult<T> {
  const [query, setQuery] = useState(options?.initialQuery ?? "");

  const clearQuery = useCallback(() => setQuery(""), []);

  const getSearchText = options?.getSearchText;
  const searchKeys = options?.searchKeys;

  const filteredData = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return data;

    return data.filter((item) => {
      if (getSearchText) {
        return getSearchText(item).toLowerCase().includes(trimmed);
      }

      const record = item as Record<string, unknown>;
      const keys = searchKeys && searchKeys.length > 0 ? searchKeys : (Object.keys(record) as (keyof T)[]);
      return keys.some((key) => {
        const value = record[key as string];
        if (value == null) return false;
        return String(value).toLowerCase().includes(trimmed);
      });
    });
  }, [data, query, getSearchText, searchKeys]);

  return { query, setQuery, clearQuery, filteredData };
}

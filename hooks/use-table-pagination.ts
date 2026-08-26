"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseTablePaginationOptions {
  /** Number of rows per page. Defaults to 10. */
  pageSize?: number;
  /** Initial page (1-based). Defaults to 1. */
  initialPage?: number;
  /** Called whenever the page changes. */
  onPageChange?: (page: number) => void;
}

export interface UseTablePaginationResult<T> {
  /** Current page (1-based). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Number of rows per page. */
  pageSize: number;
  /** The slice of `data` for the current page. */
  pageItems: T[];
  /** Total number of rows. */
  totalItems: number;
  /** Go to a specific page (clamped to valid range). */
  goToPage: (page: number) => void;
  /** Go to the next page. */
  nextPage: () => void;
  /** Go to the previous page. */
  previousPage: () => void;
  /** Reset to the first page. */
  firstPage: () => void;
  /** Go to the last page. */
  lastPage: () => void;
  /** Change the page size and reset to the first page. */
  setPageSize: (size: number) => void;
}

/**
 * Generic, framework-agnostic pagination hook for tabular data.
 *
 * Owns pagination state and returns the slice of data for the current page.
 * Pages are 1-based. Works with any array — no CRM knowledge.
 */
export function useTablePagination<T>(
  data: T[],
  options?: UseTablePaginationOptions
): UseTablePaginationResult<T> {
  const [requestedPage, setRequestedPage] = useState(options?.initialPage ?? 1);
  const [pageSize, setPageSizeState] = useState(options?.pageSize ?? 10);

  const totalItems = data.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  // Derive the effective page by clamping without a synchronizing effect.
  const page = Math.min(Math.max(requestedPage, 1), totalPages);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 1), totalPages);
      setRequestedPage(clamped);
    },
    [totalPages]
  );

  const nextPage = useCallback(
    () => setRequestedPage((p) => Math.min(p + 1, totalPages)),
    [totalPages]
  );
  const previousPage = useCallback(
    () => setRequestedPage((p) => Math.max(p - 1, 1)),
    []
  );
  const firstPage = useCallback(() => setRequestedPage(1), []);
  const lastPage = useCallback(
    () => setRequestedPage(totalPages),
    [totalPages]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Math.max(1, size));
    setRequestedPage(1);
  }, []);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const onPageChange = options?.onPageChange;
  useEffect(() => {
    onPageChange?.(page);
  }, [page, onPageChange]);

  return {
    page,
    totalPages,
    pageSize,
    pageItems,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize,
  };
}

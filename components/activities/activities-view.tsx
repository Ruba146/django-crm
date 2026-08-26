"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTableFiltering, useTableSorting } from "@/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import type {
  ActivityFilterOptions,
  ActivityRecord,
  ActivityTimeline,
} from "@/types";
import {
  ActivityDetails,
  ActivityDetailsLoading,
  ActivityEmptyState,
  ActivityFilters,
  ActivityHeader,
  ActivityTable,
  ActivityToolbar,
} from "./index";
import { EMPTY_FILTERS, type ActivityFiltersState } from "./activity-filters";
import { DEFAULT_COLUMNS, type ActivityColumns } from "./activity-toolbar";
import { RecordModal } from "@/components/shared/record-modal";

/**
 * Activities view — the client-side brain of the Activities module.
 *
 * The left table shows ONE row per unique record (Lead / Deal / Customer)
 * that has activity history. Search/filter/sort/pagination run against the
 * records loaded from SQLite.
 *
 * When a record is selected a centered modal opens, showing that record's
 * complete activity timeline. The timeline is loaded on demand through
 * `app/api/activities/[id]/route.ts` — it is never preloaded, so thousands
 * of activities are never fetched up front.
 *
 * Refresh uses Next.js App Router `router.refresh()` to re-run the page's
 * server components (which re-read SQLite) without reloading the app.
 */
export function ActivitiesView({
  records,
  filterOptions,
  locale = "en",
}: {
  records: ActivityRecord[];
  filterOptions: ActivityFilterOptions;
  locale?: string;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  /* ---- Search + sort ---- */
  const filtering = useTableFiltering(records, {
    getSearchText: (r) =>
      [
        r.name,
        r.company,
        r.ownerName,
        r.stage?.label,
        r.source?.label,
        r.phone,
        r.email,
        r.entity_type,
      ]
        .filter(Boolean)
        .join(" "),
  });

  const sorting = useTableSorting(filtering.filteredData, {
    getSortValue: (r, columnId) => {
      switch (columnId) {
        case "name":
          return r.name ?? "";
        case "company":
          return r.company ?? "";
        case "last_activity":
          return r.last_activity_at ?? "";
        case "activity_count":
          return r.activity_count;
        case "entity_type":
          return r.entity_type ?? "";
        default:
          return (r as unknown as Record<string, unknown>)[columnId];
      }
    },
  });

  /* ---- Filters (activity type / user / entity type / date) — combinable ---- */
  const [filters, setFilters] = useState<ActivityFiltersState>(EMPTY_FILTERS);

  const filteredBySelects = useMemo(() => {
    let rows = sorting.sortedData;
    if (filters.activityTypeId)
      rows = rows.filter((r) => r.activityTypeIds.includes(filters.activityTypeId));
    if (filters.userId)
      rows = rows.filter((r) => r.ownerId === filters.userId);
    if (filters.entityType)
      rows = rows.filter((r) => r.entity_type === filters.entityType);
    if (filters.dateFrom) {
      const from = new Date(`${filters.dateFrom}T00:00:00`);
      rows = rows.filter(
        (r) => r.last_activity_at != null && new Date(r.last_activity_at) >= from
      );
    }
    if (filters.dateTo) {
      const to = new Date(`${filters.dateTo}T23:59:59`);
      rows = rows.filter(
        (r) => r.last_activity_at != null && new Date(r.last_activity_at) <= to
      );
    }
    return rows;
  }, [sorting.sortedData, filters]);

  /* ---- Pagination ---- */
  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredBySelects.length / DEFAULT_PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredBySelects.slice(
    (safePage - 1) * DEFAULT_PAGE_SIZE,
    safePage * DEFAULT_PAGE_SIZE
  );

  /* ---- Column visibility ---- */
  const [columns, setColumns] = useState<ActivityColumns>(DEFAULT_COLUMNS);

  /* ---- Selected record + timeline modal ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ActivityTimeline | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/activities/${encodeURIComponent(selectedId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        if (cancelled) return;
        setTimeline(data as ActivityTimeline);
      })
      .catch(() => {
        if (!cancelled) setTimeline(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const handler = () => {
      startTransition(() => {
        router.refresh();
      });
    };
    window.addEventListener("ai-action-executed", handler);
    return () => window.removeEventListener("ai-action-executed", handler);
  }, [router, startTransition]);

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setTimeline(null);
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setTimeline(null);
  };

  const handleRefresh = () => {
    startTransition(() => {
      setSelectedId(null);
      setTimeline(null);
      router.refresh();
    });
  };

  const showEmpty = filtering.filteredData.length === 0;

  return (
    <div className="space-y-6">
      <ActivityHeader
        total={records.length}
        locale={locale}
        onCreateActivity={() => setCreateOpen(true)}
        onRefresh={handleRefresh}
        refetching={isRefreshing}
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(filtering.filteredData, null, 2)],
            { type: "application/json" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "activities.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* Create Activity (UI only) — reserved modal placeholder */}
      {createOpen && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Activity creation is not available yet. This is a UI-only placeholder.
          <button
            type="button"
            className="ms-2 font-medium text-primary hover:underline"
            onClick={() => setCreateOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      <ActivityToolbar
        query={filtering.query}
        onQueryChange={(q) => {
          filtering.setQuery(q);
          setPage(1);
        }}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <ActivityFilters
        options={filterOptions}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      {showEmpty ? (
        <ActivityEmptyState />
      ) : (
        <ActivityTable
          records={pageItems}
          columns={columns}
          sort={sorting.sort}
          onSortChange={sorting.toggleSort}
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyState={
            filtering.filteredData.length === 0
              ? {
                  title: "No records found",
                  description: "Try adjusting your search or filters.",
                }
              : null
          }
        />
      )}

      {/* Centered modal for record timeline */}
      <RecordModal
        open={!!selectedId}
        onClose={handleClose}
        title={
          timeline
            ? `${timeline.record.name ?? "Unnamed record"} — Activity Timeline`
            : "Activity Timeline"
        }
      >
        <AnimatePresence mode="wait">
          {timeline ? (
            <motion.div
              key={`timeline-${timeline.record.id}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              <ActivityDetails
                record={timeline.record}
                timeline={timeline.timeline}
              />
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <ActivityDetailsLoading />
            </motion.div>
          )}
        </AnimatePresence>
      </RecordModal>
    </div>
  );
}

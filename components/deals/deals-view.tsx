"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTableSorting } from "@/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import { useSetRecordContext } from "@/components/ai/copilot";
import type {
  DealActivity,
  DealDetail,
  DealFilterOptions,
  DealListItem,
  DealTask,
  DealPageResult,
} from "@/types";
import type { DealAnalysis } from "@/services/ai-analysis.service";
import {
  DealDetails,
  DealDetailsLoading,
  DealEmptyState,
  DealFilters,
  DealHeader,
  DealTable,
  DealToolbar,
} from "./index";
import { EMPTY_FILTERS, type DealFiltersState } from "./deal-filters";
import { DEFAULT_COLUMNS, type DealColumns } from "./deal-toolbar";
import { RecordModal } from "@/components/shared/record-modal";
import { useQuery } from "@tanstack/react-query";

/**
 * Deals view — client component that fetches paginated deals from the
 * server-side `/api/records` endpoint. Search, filter and pagination
 * all run against real SQLite data via the API.
 */
export function DealsView({
  filterOptions,
  locale = "en",
}: {
  filterOptions: DealFilterOptions;
  locale?: string;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<DealFiltersState>(EMPTY_FILTERS);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("type", "deals");
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("search", search.trim());
    if (filters.ownerId) p.set("ownerId", filters.ownerId);
    if (filters.stageId) p.set("stageId", filters.stageId);
    if (filters.statusId) p.set("statusId", filters.statusId);
    if (filters.createdFrom) p.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) p.set("createdTo", filters.createdTo);
    return p.toString();
  }, [page, pageSize, search, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["records", "deals", page, pageSize, search, filters],
    queryFn: async () => {
      const res = await fetch(`/api/records?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch deals");
      return (await res.json()) as DealPageResult;
    },
  });

  const deals = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const sorting = useTableSorting<DealListItem>(deals, {
    getSortValue: useCallback((d: DealListItem, columnId: string) => {
      switch (columnId) {
        case "name":
          return d.name ?? "";
        case "company":
          return d.company ?? "";
        case "lead":
          return d.leadName ?? "";
        case "owner":
          return d.ownerName ?? "";
        case "stage":
          return d.stage?.label ?? "";
        case "expected_value":
          return d.expected_value_minor ?? -1;
        case "probability":
          return d.probability_pct ?? -1;
        case "target_close_date":
          return d.target_close_date ?? "";
        case "created_at":
          return d.created_at ?? "";
        case "status":
          return d.status ?? "";
        default:
          return (d as unknown as Record<string, unknown>)[columnId];
      }
    }, []),
  });

  /* ---- Column visibility ---- */
  const [columns, setColumns] = useState<DealColumns>(DEFAULT_COLUMNS);

  /* ---- Selected deal + modal ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [analysis, setAnalysis] = useState<DealAnalysis | null>(null);

  const { setRecordContext } = useSetRecordContext();

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/deals/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        if (cancelled) return;
        setDetail(data.detail ?? null);
        setActivities(data.activities ?? []);
        setTasks(data.tasks ?? []);
        setAnalysis(data.analysis ?? null);
        const d = data.detail;
        if (d) {
          setRecordContext({
            recordId: selectedId,
            recordType: "deal",
            recordName: d.name,
            recordCompany: d.company,
            recordStage: d.stage?.label,
            recordOwner: d.ownerName,
            recordStatus: d.status,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setAnalysis(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, setRecordContext]);

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
      setRecordContext({ recordId: undefined, recordType: undefined, recordName: undefined, recordCompany: undefined, recordStage: undefined, recordOwner: undefined, recordStatus: undefined });
    } else {
      setSelectedId(id);
      setRecordContext({ recordId: id, recordType: "deal" });
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setDetail(null);
    setActivities([]);
    setTasks([]);
    setAnalysis(null);
  };

  const handleRefresh = () => {
    startTransition(() => {
      setSelectedId(null);
      setAnalysis(null);
      router.refresh();
    });
  };

  const handleActionComplete = () => {
    if (selectedId) {
      fetch(`/api/deals/${selectedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setDetail(data.detail ?? null);
          setActivities(data.activities ?? []);
          setTasks(data.tasks ?? []);
          setAnalysis(data.analysis ?? null);
        })
        .catch(() => {});
    }
  };

  const showEmpty = deals.length === 0 && !isLoading;

  return (
    <div className="space-y-6">
      <DealHeader
        total={total}
        locale={locale}
        onCreateDeal={() => setCreateOpen(true)}
        onRefresh={handleRefresh}
        refetching={isRefreshing || isFetching}
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(deals, null, 2)],
            { type: "application/json" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "deals.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* Create Deal (UI only) — reserved modal placeholder */}
      {createOpen && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Deal creation is not available yet. This is a UI-only placeholder.
          <button
            type="button"
            className="ms-2 font-medium text-primary hover:underline"
            onClick={() => setCreateOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      <DealToolbar
        query={search}
        onQueryChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <DealFilters
        options={filterOptions}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      {showEmpty ? (
        <DealEmptyState />
      ) : (
        <DealTable
          deals={sorting.sortedData}
          columns={columns}
          sort={sorting.sort}
          onSortChange={sorting.toggleSort}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyState={
            deals.length === 0
              ? {
                  title: "No deals found",
                  description: "Try adjusting your search or filters.",
                }
              : null
          }
        />
      )}

      {/* Centered modal for deal detail */}
      <RecordModal
        open={!!selectedId}
        onClose={handleClose}
        title={
          detail
            ? `${detail.name ?? "Unnamed deal"} — Deal Details`
            : "Deal Details"
        }
      >
        <AnimatePresence mode="wait">
          {detail ? (
            <motion.div
              key={`detail-${detail.id}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
                    <DealDetails
                      deal={detail}
                      activities={activities}
                      tasks={tasks}
                      analysis={analysis}
                      locale={locale}
                      onActionComplete={handleActionComplete}
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
              <DealDetailsLoading />
            </motion.div>
          )}
        </AnimatePresence>
      </RecordModal>
    </div>
  );
}

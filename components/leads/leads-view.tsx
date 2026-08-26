"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTableSorting } from "@/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import { useSetRecordContext } from "@/components/ai/copilot";
import type {
  LeadActivity,
  LeadDeal,
  LeadDetail,
  LeadFilterOptions,
  LeadListItem,
  LeadTask,
  LeadPageResult,
} from "@/types";
import type { LeadAnalysis } from "@/services/ai-analysis.service";
import {
  LeadDetails,
  LeadDetailsLoading,
  LeadEmptyState,
  LeadFilters,
  LeadHeader,
  LeadTable,
  LeadToolbar,
} from "./index";
import { EMPTY_FILTERS, type LeadFiltersState } from "./lead-filters";
import { DEFAULT_COLUMNS, type LeadColumns } from "./lead-toolbar";
import { RecordModal } from "@/components/shared/record-modal";
import { useQuery } from "@tanstack/react-query";

/**
 * Leads view — client component that fetches paginated leads from the
 * server-side `/api/records` endpoint. Search, filter and pagination
 * all run against real SQLite data via the API.
 */
export function LeadsView({
  filterOptions,
  locale = "en",
}: {
  filterOptions: LeadFilterOptions;
  locale?: string;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LeadFiltersState>(EMPTY_FILTERS);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("type", "leads");
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("search", search.trim());
    if (filters.ownerId) p.set("ownerId", filters.ownerId);
    if (filters.sourceId) p.set("sourceId", filters.sourceId);
    if (filters.stageId) p.set("stageId", filters.stageId);
    if (filters.createdFrom) p.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) p.set("createdTo", filters.createdTo);
    return p.toString();
  }, [page, pageSize, search, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["records", "leads", page, pageSize, search, filters],
    queryFn: async () => {
      const res = await fetch(`/api/records?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return (await res.json()) as LeadPageResult;
    },
  });

  const leads = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const sorting = useTableSorting<LeadListItem>(leads, {
    getSortValue: (l, columnId) => {
      switch (columnId) {
        case "name":
          return l.full_name ?? "";
        case "created_at":
          return l.created_at ?? "";
        case "last_activity":
          return l.last_activity_at ?? "";
        case "probability":
          return l.probability_pct ?? -1;
        default:
          return (l as unknown as Record<string, unknown>)[columnId];
      }
    },
  });

  /* ---- Column visibility ---- */
  const [columns, setColumns] = useState<LeadColumns>(DEFAULT_COLUMNS);

  /* ---- Selected lead + modal ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [deals, setDeals] = useState<LeadDeal[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);

  const { setRecordContext } = useSetRecordContext();

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/leads/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        if (cancelled) return;
        setDetail(data.detail ?? null);
        setActivities(data.activities ?? []);
        setDeals(data.deals ?? []);
        setTasks(data.tasks ?? []);
        setAnalysis(data.analysis ?? null);
        const l = data.detail;
        if (l) {
          setRecordContext({
            recordId: selectedId,
            recordType: "lead",
            recordName: l.fullName,
            recordCompany: l.company,
            recordStage: l.stage,
            recordOwner: l.ownerName,
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
      setDetail(null);
      setActivities([]);
      setDeals([]);
      setTasks([]);
      setAnalysis(null);
      setRecordContext({ recordId: id, recordType: "lead" });
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setDetail(null);
    setActivities([]);
    setDeals([]);
    setTasks([]);
    setAnalysis(null);
  };

  const handleRefresh = () => {
    startTransition(() => {
      setSelectedId(null);
      setDetail(null);
      setActivities([]);
      setDeals([]);
      setTasks([]);
      setAnalysis(null);
      router.refresh();
    });
  };

  const handleActionComplete = () => {
    if (selectedId) {
      fetch(`/api/leads/${selectedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setDetail(data.detail ?? null);
          setActivities(data.activities ?? []);
          setDeals(data.deals ?? []);
          setTasks(data.tasks ?? []);
          setAnalysis(data.analysis ?? null);
        })
        .catch(() => {});
    }
  };

  const showEmpty = leads.length === 0 && !isLoading;

  return (
    <div className="space-y-6">
      <LeadHeader
        total={total}
        locale={locale}
        onCreateLead={() => setCreateOpen(true)}
        onRefresh={handleRefresh}
        refetching={isRefreshing || isFetching}
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(leads, null, 2)],
            { type: "application/json" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "leads.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* Create Lead (UI only) — reserved modal placeholder */}
      {createOpen && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Lead creation is not available yet. This is a UI-only placeholder.
          <button
            type="button"
            className="ms-2 font-medium text-primary hover:underline"
            onClick={() => setCreateOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      <LeadToolbar
        query={search}
        onQueryChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <LeadFilters
        options={filterOptions}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      {showEmpty ? (
        <LeadEmptyState />
      ) : (
        <LeadTable
          leads={sorting.sortedData}
          columns={columns}
          sort={sorting.sort}
          onSortChange={sorting.toggleSort}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyState={
            leads.length === 0
              ? {
                  title: "No leads found",
                  description: "Try adjusting your search or filters.",
                }
              : null
          }
        />
      )}

      {/* Centered modal for lead detail */}
      <RecordModal
        open={!!selectedId}
        onClose={handleClose}
        title={
          detail
            ? `${detail.full_name ?? "Unnamed lead"} — Lead Details`
            : "Lead Details"
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
                    <LeadDetails
                      lead={detail}
                      activities={activities}
                      deals={deals}
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
              <LeadDetailsLoading />
            </motion.div>
          )}
        </AnimatePresence>
      </RecordModal>
    </div>
  );
}

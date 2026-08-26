"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTableSorting } from "@/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import { useSetRecordContext } from "@/components/ai/copilot";
import type {
  TaskDetail,
  TaskFilterOptions,
  TaskListItem,
  TaskRelatedRecord,
  TaskPageResult,
} from "@/types";
import type { TaskAnalysis } from "@/services/ai-analysis.service";
import {
  TaskDetails,
  TaskDetailsLoading,
  TaskEmptyState,
  TaskFilters,
  TaskHeader,
  TaskTable,
  TaskToolbar,
} from "./index";
import { EMPTY_FILTERS, type TaskFiltersState } from "./task-filters";
import { DEFAULT_COLUMNS, type TaskColumns } from "./task-toolbar";
import { RecordModal } from "@/components/shared/record-modal";
import { useQuery } from "@tanstack/react-query";

/**
 * Tasks view — client component that fetches paginated tasks from the
 * server-side `/api/records` endpoint. Search, filter and pagination
 * all run against real SQLite data via the API.
 */
export function TasksView({
  filterOptions,
  locale = "en",
}: {
  filterOptions: TaskFilterOptions;
  locale?: string;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<TaskFiltersState>(EMPTY_FILTERS);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("type", "tasks");
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("search", search.trim());
    if (filters.assigneeId) p.set("assigneeId", filters.assigneeId);
    if (filters.taskTypeId) p.set("taskTypeId", filters.taskTypeId);
    if (filters.entityType) p.set("entityType", filters.entityType);
    if (filters.dueFrom) p.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) p.set("dueTo", filters.dueTo);
    return p.toString();
  }, [page, pageSize, search, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["records", "tasks", page, pageSize, search, filters],
    queryFn: async () => {
      const res = await fetch(`/api/records?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return (await res.json()) as TaskPageResult;
    },
  });

  const tasks = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const sorting = useTableSorting<TaskListItem>(tasks, {
    getSortValue: (t, columnId) => {
      switch (columnId) {
        case "title":
          return t.title ?? "";
        case "createdAt":
          return t.created_at ?? "";
        case "dueDate":
          return t.due_at ?? "";
        case "status":
          return t.status ?? "";
        default:
          return (t as unknown as Record<string, unknown>)[columnId];
      }
    },
  });

  /* ---- Column visibility ---- */
  const [columns, setColumns] = useState<TaskColumns>(DEFAULT_COLUMNS);

  /* ---- Selected task + modal ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [relatedRecord, setRelatedRecord] = useState<TaskRelatedRecord | null>(null);
  const [analysis, setAnalysis] = useState<TaskAnalysis | null>(null);

  const { setRecordContext } = useSetRecordContext();

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/tasks/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        if (cancelled) return;
        setDetail(data.detail ?? null);
        setRelatedRecord(data.relatedRecord ?? null);
        setAnalysis(data.analysis ?? null);
        const t = data.detail;
        if (t) {
          setRecordContext({
            recordId: selectedId,
            recordType: "task",
            recordName: t.title,
            recordCompany: t.companyName,
            recordStage: t.relatedRecordStage,
            recordOwner: t.assigneeName,
            recordStatus: t.status,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setRelatedRecord(null);
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
      setRelatedRecord(null);
      setAnalysis(null);
      setRecordContext({ recordId: id, recordType: "task" });
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setDetail(null);
    setRelatedRecord(null);
    setAnalysis(null);
  };

  const handleRefresh = () => {
    startTransition(() => {
      setSelectedId(null);
      setDetail(null);
      setRelatedRecord(null);
      setAnalysis(null);
      router.refresh();
    });
  };

  const handleActionComplete = () => {
    if (selectedId) {
      fetch(`/api/tasks/${selectedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setDetail(data.detail ?? null);
          setRelatedRecord(data.relatedRecord ?? null);
          setAnalysis(data.analysis ?? null);
        })
        .catch(() => {});
    }
  };

  const showEmpty = tasks.length === 0 && !isLoading;

  return (
    <div className="space-y-6">
      <TaskHeader
        total={total}
        locale={locale}
        onCreateTask={() => setCreateOpen(true)}
        onRefresh={handleRefresh}
        refetching={isRefreshing || isFetching}
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(tasks, null, 2)],
            { type: "application/json" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "tasks.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* Create Task (UI only) — reserved modal placeholder */}
      {createOpen && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Task creation is not available yet. This is a UI-only placeholder.
          <button
            type="button"
            className="ms-2 font-medium text-primary hover:underline"
            onClick={() => setCreateOpen(false)}
          >
            Close
          </button>
        </div>
      )}

      <TaskToolbar
        query={search}
        onQueryChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <TaskFilters
        options={filterOptions}
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      {showEmpty ? (
        <TaskEmptyState />
      ) : (
        <TaskTable
          tasks={sorting.sortedData}
          columns={columns}
          sort={sorting.sort}
          onSortChange={sorting.toggleSort}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedId={selectedId}
          onSelect={handleSelect}
          emptyState={
            tasks.length === 0
              ? {
                  title: "No tasks found",
                  description: "Try adjusting your search or filters.",
                }
              : null
          }
        />
      )}

      {/* Centered modal for task detail */}
      <RecordModal
        open={!!selectedId}
        onClose={handleClose}
        title={
          detail
            ? `${detail.title ?? "Unnamed task"} — Task Details`
            : "Task Details"
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
              <TaskDetails
                record={detail}
                relatedRecord={relatedRecord}
                analysis={analysis}
                onClose={handleClose}
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
              <TaskDetailsLoading />
            </motion.div>
          )}
        </AnimatePresence>
      </RecordModal>
    </div>
  );
}

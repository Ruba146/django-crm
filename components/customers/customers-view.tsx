"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTableSorting } from "@/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import { useSetRecordContext } from "@/components/ai/copilot";
import type {
  Contact,
  CustomerActivity,
  CustomerDeal,
  CustomerDetail,
  CustomerFilterOptions,
  CustomerListItem,
  CustomerStatistics,
  CustomerTask,
  CustomerPageResult,
} from "@/types";
import type { CustomerAnalysis } from "@/services/ai-analysis.service";
import {
  CustomerDetails,
  CustomerDetailsLoading,
  CustomerEmptyState,
  CustomerFilters,
  CustomerHeader,
  CustomerTable,
  CustomerToolbar,
} from "./index";
import { EMPTY_FILTERS, type CustomerFiltersState } from "./customer-filters";
import { DEFAULT_COLUMNS, type CustomerColumns } from "./customer-toolbar";
import { useQuery } from "@tanstack/react-query";

/**
 * Customers view — client component that fetches paginated customers from the
 * server-side `/api/records` endpoint. Search, filter and pagination
 * all run against real SQLite data via the API.
 */
export function CustomersView({
  filterOptions,
  locale = "en",
}: {
  filterOptions: CustomerFilterOptions;
  locale?: string;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CustomerFiltersState>(EMPTY_FILTERS);

  /* ---- Column visibility ---- */
  const [columns, setColumns] = useState<CustomerColumns>(DEFAULT_COLUMNS);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("type", "customers");
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("search", search.trim());
    if (filters.industryId) p.set("industryId", filters.industryId);
    if (filters.sourceId) p.set("sourceId", filters.sourceId);
    if (filters.ownerId) p.set("ownerId", filters.ownerId);
    if (filters.statusId) p.set("statusId", filters.statusId);
    return p.toString();
  }, [page, pageSize, search, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["records", "customers", page, pageSize, search, filters],
    queryFn: async () => {
      const res = await fetch(`/api/records?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return (await res.json()) as CustomerPageResult;
    },
  });

  const customers = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const sorting = useTableSorting<CustomerListItem>(customers, {
    getSortValue: (c, columnId) => {
      switch (columnId) {
        case "name":
          return c.name ?? "";
        case "created_at":
          return c.created_at ?? "";
        default:
          return (c as unknown as Record<string, unknown>)[columnId];
      }
    },
  });

  /* ---- Selected customer + split view ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [stats, setStats] = useState<CustomerStatistics | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<CustomerDeal[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [tasks, setTasks] = useState<CustomerTask[]>([]);
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);

  const { setRecordContext } = useSetRecordContext();

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    fetch(`/api/customers/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        if (cancelled) return;
        setDetail(data.detail ?? null);
        setStats(data.statistics ?? null);
        setContacts(data.detail?.contacts ?? []);
        setDeals(data.deals ?? []);
        setActivities(data.activities ?? []);
        setTasks(data.tasks ?? []);
        setAnalysis(data.analysis ?? null);
        const c = data.detail;
        if (c) {
          setRecordContext({
            recordId: selectedId,
            recordType: "customer",
            recordName: c.name,
            recordCompany: c.name,
            recordOwner: c.ownerName,
            recordStatus: c.status,
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
    setSelectedId((cur) => {
      if (cur === id) {
        setRecordContext({ recordId: undefined, recordType: undefined, recordName: undefined, recordCompany: undefined, recordStage: undefined, recordOwner: undefined, recordStatus: undefined });
        return null;
      }
      setDetail(null);
      setStats(null);
      setContacts([]);
      setDeals([]);
      setActivities([]);
      setTasks([]);
      setAnalysis(null);
      setRecordContext({ recordId: id, recordType: "customer" });
      return id;
    });
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
      fetch(`/api/customers/${selectedId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setDetail(data.detail ?? null);
          setStats(data.statistics ?? null);
          setContacts(data.detail?.contacts ?? []);
          setDeals(data.deals ?? []);
          setActivities(data.activities ?? []);
          setTasks(data.tasks ?? []);
          setAnalysis(data.analysis ?? null);
        })
        .catch(() => {});
    }
  };

  const handleGeneratePackage = (id: string) => {
    fetch(`/api/customers/${id}/package`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to generate package"))))
      .then((pkg) => {
        const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `customer-package-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error("Failed to generate customer package:", err);
      });
  };

  const showEmpty = customers.length === 0 && !isLoading;

  return (
    <div className="space-y-6">
      <CustomerHeader
        total={total}
        locale={locale}
        onRefresh={handleRefresh}
        refetching={isRefreshing || isFetching}
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(customers, null, 2)],
            { type: "application/json" }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "customers.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {/* Only render a side-by-side layout when a customer is selected. */}
      <div
        className={
          selectedId
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
            : ""
        }
      >
        {/* List — spans full width when no customer is selected */}
        <div className="space-y-4">
          <CustomerToolbar
            query={search}
            onQueryChange={(q) => {
              setSearch(q);
              setPage(1);
            }}
            columns={columns}
            onColumnsChange={setColumns}
          />

          <CustomerFilters
            options={filterOptions}
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
          />

          {showEmpty ? (
            <CustomerEmptyState />
          ) : (
          <CustomerTable
            customers={sorting.sortedData}
            sort={sorting.sort}
            onSortChange={sorting.toggleSort}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            selectedId={selectedId}
            onSelect={handleSelect}
            emptyState={
              customers.length === 0
                ? {
                    title: "No customers found",
                    description: "Try adjusting your search or filters.",
                  }
                : null
            }
            onGeneratePackage={handleGeneratePackage}
          />
          )}
        </div>

        {/* Details panel — rendered only when a customer is selected */}
        {selectedId && (
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
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
                    <CustomerDetails
                      customer={detail}
                      stats={stats}
                      contacts={contacts}
                      deals={deals}
                      activities={activities}
                      tasks={tasks}
                      analysis={analysis}
                      locale={locale}
                      onClose={() => setSelectedId(null)}
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
                    <CustomerDetailsLoading />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

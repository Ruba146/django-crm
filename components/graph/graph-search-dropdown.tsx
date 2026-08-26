"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Search, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/definitions";
import type { GraphRecordItem, RecordsListResponse } from "@/types/graph";

type Category = "leads" | "deals";

interface GraphSearchDropdownProps {
  onSelect: (result: {
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  }) => void;
  selectedRecord?: {
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  } | null;
  onClear?: () => void;
}

export function GraphSearchDropdown({ onSelect, selectedRecord, onClear }: GraphSearchDropdownProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["graph-records-list", category, page, pageSize, search],
    queryFn: async () => {
      if (!category) return { records: [], total: 0, page: 1, pageSize, totalPages: 1 } as RecordsListResponse;
      const params = new URLSearchParams({
        category,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await fetch(`/api/graph/records-list?${params.toString()}`);
      if (!res.ok) return { records: [], total: 0, page, pageSize, totalPages: 1 } as RecordsListResponse;
      return (await res.json()) as RecordsListResponse;
    },
    enabled: !!category,
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  const handleCategorySelect = useCallback((cat: Category) => {
    setCategory(cat);
    setPage(1);
    setSearch("");
    onClear?.();
  }, [onClear]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleSelect = useCallback(
    (item: GraphRecordItem) => {
      onSelect({
        entityType: item.entityType,
        entityId: item.entityId,
        displayName: item.displayName,
        secondaryText: item.secondaryText,
      });
      setSearch("");
      setPage(1);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setSearch("");
    setCategory(null);
    setPage(1);
    onClear?.();
  }, [onClear]);

  return (
    <div className="h-full flex flex-col">
      {selectedRecord && (
        <div className="shrink-0 h-10 p-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0B1120]">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="neutral"
              className={`shrink-0 ${
                selectedRecord.entityType === "deal"
                  ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                  : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}
            >
              {selectedRecord.entityType === "deal" ? "Deal" : "Lead"}
            </Badge>
            <span className="text-sm font-semibold truncate text-zinc-100">{selectedRecord.displayName}</span>
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 size-6 text-zinc-500 hover:text-zinc-100"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            <span className="text-xs">✕</span>
          </Button>
        </div>
      )}

      <div className="shrink-0 mt-3">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={selectedRecord ? "Search to change record..." : `Search ${category === "deals" ? "deals" : category === "leads" ? "leads" : "leads, deals..."}`}
          className="bg-[#0B1120] border-white/10 text-slate-200 placeholder:text-slate-500"
          disabled={!category}
        />
      </div>

      <div className="shrink-0 mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B1120] p-0.5">
        <Button
          variant={category === "leads" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleCategorySelect("leads")}
          className={`rounded-md h-7 text-[11px] px-2.5 transition-colors ${
            category === "leads"
              ? "bg-cyan-500/15 text-cyan-300 hover:text-cyan-200"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Leads
        </Button>
        <Button
          variant={category === "deals" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleCategorySelect("deals")}
          className={`rounded-md h-7 text-[11px] px-2.5 transition-colors ${
            category === "deals"
              ? "bg-purple-500/15 text-purple-300 hover:text-purple-200"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Deals
        </Button>
      </div>

      <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
        {!category ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs text-slate-400">Select a category above to browse records.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#0B1120] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">{category === "leads" ? "Leads" : "Deals"}</h3>
                <p className="text-[10px] text-slate-500">{total.toLocaleString()} records</p>
              </div>
              <span className="text-[10px] text-slate-500">
                {total > 0
                  ? `Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${total.toLocaleString()}`
                  : `${total.toLocaleString()} record${total !== 1 ? "s" : ""}`}
              </span>
            </div>

            <div>
              {isLoading && records.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-slate-400" />
                </div>
              )}

              {isFetching && !isLoading && records.length > 0 && (
                <div className="flex items-center justify-center py-2 border-b border-white/5">
                  <Loader2 className="size-3 animate-spin text-slate-400" />
                </div>
              )}

              {!isLoading && records.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Search className="size-6 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">
                    {search.trim()
                      ? `No matching ${category === "leads" ? "leads" : "deals"} found.`
                      : `No ${category === "leads" ? "leads" : "deals"} found.`}
                  </p>
                </div>
              )}

              {records.map((item) => (
                <button
                  key={`${item.entityType}:${item.entityId}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-start transition-colors hover:bg-white/5 border-b border-white/5 last:border-b-0 ${
                    selectedRecord?.entityId === item.entityId && selectedRecord?.entityType === item.entityType
                      ? "bg-white/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="neutral"
                      className={`shrink-0 text-[10px] h-5 px-1.5 ${
                        item.entityType === "deal"
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                          : "bg-zinc-800 text-zinc-300 border-zinc-700"
                      }`}
                    >
                      {item.entityType === "deal" ? "Deal" : "Lead"}
                    </Badge>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate text-slate-200 block">{item.displayName}</span>
                      {item.secondaryText && (
                        <span className="text-[10px] truncate text-slate-500 block">{item.secondaryText}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="border-t border-white/10 p-3 flex items-center justify-between gap-2">
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  className="flex-1 justify-center"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

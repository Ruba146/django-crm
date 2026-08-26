"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, X } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";
import type { DigitalTwinSearchGroup, DigitalTwinSearchResultItem } from "@/types/digital-twin";

const GROUP_LABELS: Record<keyof DigitalTwinSearchGroup, string> = {
  customers: "Customers",
  leads: "Leads",
  deals: "Deals",
  employees: "Employees",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  customer: "Customer",
  lead: "Lead",
  deal: "Deal",
  user: "Employee",
};

export interface RecordSelectorProps {
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
  placeholder?: string;
  variant?: "default" | "dark";
}

export function RecordSelector({
  onSelect,
  selectedRecord,
  onClear,
  placeholder = "Search customers, leads, deals, employees...",
  variant = "default",
}: RecordSelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setDropdownStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 100,
        });
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const searchQuery = useQuery({
    queryKey: ["record-selector", search, isOpen],
    queryFn: async () => {
      const res = await fetch(`/api/digital-twin/search?q=${encodeURIComponent(search)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data === "object" && "results" in data) {
        return data.results as DigitalTwinSearchGroup;
      }
      return null;
    },
    enabled: isOpen,
  });

  const handleSelect = useCallback(
    (item: DigitalTwinSearchResultItem) => {
      onSelect({
        entityType: item.entityType,
        entityId: item.entityId,
        displayName: item.displayName,
        secondaryText: item.secondaryText,
      });
      setSearch("");
    },
    [onSelect]
  );

  const handleClearSelection = useCallback(() => {
    setSearch("");
    onClear?.();
  }, [onClear]);

  const queryError = searchQuery.error instanceof Error ? searchQuery.error.message : null;

  const hasResults =
    searchQuery.data &&
    (searchQuery.data.customers.length > 0 ||
      searchQuery.data.leads.length > 0 ||
      searchQuery.data.deals.length > 0 ||
      searchQuery.data.employees.length > 0);

  const isEmptyDiscovery = !search.trim() && hasResults;

  const isDark = variant === "dark";

  const dropdown = (
    <div
      style={dropdownStyle}
      className={cn(
        "max-h-[300px] overflow-y-auto rounded-xl border shadow-xl",
        isDark
          ? "bg-[#0B1120] border-white/10 divide-white/10"
          : "bg-background"
      )}
    >
      {searchQuery.isLoading && isOpen && (
        <Card className={cn("p-4", isDark && "bg-[#0B1120]")}>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>Searching...</p>
        </Card>
      )}

      {queryError && isOpen && (
        <Card className={cn("p-4", isDark && "bg-[#0B1120]")}>
          <p className={cn("text-sm", isDark ? "text-red-400" : "text-danger")}>Search failed. Please try again.</p>
        </Card>
      )}

      {hasResults && !queryError && isOpen && (
        <Card className={cn("max-h-[300px] overflow-y-auto divide-y", isDark && "bg-[#0B1120] divide-white/10")}>
          {isEmptyDiscovery && (
            <div className={cn("px-4 py-2 text-xs", isDark ? "bg-white/5 text-slate-500" : "bg-muted/30 text-muted-foreground")}>
              Showing available records. Type to filter.
            </div>
          )}
          {(Object.keys(GROUP_LABELS) as Array<keyof DigitalTwinSearchGroup>).map((groupKey) => {
            const items = searchQuery.data![groupKey];
            if (!items || items.length === 0) return null;

            return (
              <div key={groupKey}>
                <div className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-wider", isDark ? "bg-white/5 text-slate-500" : "bg-muted/50 text-muted-foreground")}>
                  {GROUP_LABELS[groupKey]}
                </div>
                {items.map((item) => (
                  <button
                    key={`${item.entityType}:${item.entityId}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    className={cn("flex w-full items-center justify-between px-4 py-3 text-start transition-colors pointer-events-auto", isDark ? "text-slate-300 hover:bg-white/5" : "hover:bg-accent")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("text-sm font-medium truncate", isDark && "text-slate-200")}>{item.displayName}</span>
                      {item.isAiCopy && (
                        <Badge variant="neutral" className={cn("shrink-0", isDark ? "bg-purple-900/30 text-purple-300 border-purple-700" : "bg-purple-100 text-purple-700 border-purple-200")}>
                          AI Copy
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.secondaryText && (
                        <span className={cn("text-xs truncate max-w-[180px] hidden md:inline", isDark ? "text-slate-500" : "text-muted-foreground")}>
                          {item.secondaryText}
                        </span>
                      )}
                      <span className={cn("text-xs capitalize", isDark ? "text-slate-500" : "text-muted-foreground")}>
                        {GROUP_LABELS[groupKey].slice(0, -1)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </Card>
      )}

      {searchQuery.data && !hasResults && !queryError && isOpen && (
        <Card className={cn("flex flex-col items-center justify-center py-8 text-center", isDark && "bg-[#0B1120]")}>
          <Network className={cn("size-8 mb-2", isDark ? "text-slate-600" : "text-muted-foreground/30")} />
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>No matching records found.</p>
        </Card>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`h-10 p-2 flex items-center justify-between gap-2 rounded-lg border mb-2 ${
        isDark
          ? "border-white/10 bg-[#0B1120]"
          : "border-primary/20 bg-primary/5"
      }`}>
        {selectedRecord && (
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="neutral"
              className={`shrink-0 ${
                isDark
                  ? selectedRecord.entityType === "deal"
                    ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {ENTITY_TYPE_LABELS[selectedRecord.entityType] ?? selectedRecord.entityType}
            </Badge>
            <span className={`text-sm font-semibold truncate ${isDark ? "text-zinc-100" : ""}`}>{selectedRecord.displayName}</span>
          </div>
        )}
        <div className="flex-1" />
        {selectedRecord && (
          <Button
            variant="ghost"
            size="icon"
            className={`shrink-0 size-6 ${
              isDark
                ? "text-zinc-500 hover:text-zinc-100"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={handleClearSelection}
            aria-label="Clear selection"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      <SearchInput
        ref={inputRef}
        value={search}
        onChange={setSearch}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={
          isDark
            ? "bg-[#0B1120] border-white/10 text-slate-200 placeholder:text-slate-500"
            : undefined
        }
      />

      {isOpen && createPortal(dropdown, document.body)}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import type { PageContext } from "@/types/ai-chat";

const PAGE_MAP: Record<string, { page: PageContext["page"] }> = {
  "/": { page: "dashboard" },
  "/customers": { page: "customers" },
  "/leads": { page: "leads" },
  "/deals": { page: "deals" },
  "/activities": { page: "activities" },
  "/tasks": { page: "tasks" },
  "/reports": { page: "reports" },
  "/settings": { page: "settings" },
  "/ai": { page: "ai" },
};

export function PageContextDetector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setPageContext = useAICopilotStore((s) => s.setPageContext);

  useEffect(() => {
    const match = PAGE_MAP[pathname];
    if (!match) return;

    const recordId = searchParams.get("recordId") ?? undefined;
    const recordType = (searchParams.get("recordType") as PageContext["recordType"]) ?? undefined;
    const recordName = searchParams.get("recordName") ?? undefined;
    const recordCompany = searchParams.get("recordCompany") ?? undefined;
    const recordStage = searchParams.get("recordStage") ?? undefined;
    const recordOwner = searchParams.get("recordOwner") ?? undefined;
    const recordStatus = searchParams.get("recordStatus") ?? undefined;

    const currentFilters: Record<string, unknown> = {};
    searchParams.forEach((value, key) => {
      if (!["recordId", "recordType", "recordName", "recordCompany", "recordStage", "recordOwner", "recordStatus"].includes(key)) {
        currentFilters[key] = value;
      }
    });

    const context: PageContext = {
      page: match.page,
      route: pathname,
      recordId,
      recordType,
      recordName,
      recordCompany,
      recordStage,
      recordOwner,
      recordStatus,
      currentFilters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
    };

    setPageContext(context);
  }, [pathname, searchParams, setPageContext]);

  return null;
}

export function useSetRecordContext() {
  const setPageContext = useAICopilotStore((s) => s.setPageContext);
  const pageContext = useAICopilotStore((s) => s.pageContext);

  return {
    setRecordContext: (data: {
      recordId?: string;
      recordType?: PageContext["recordType"];
      recordName?: string;
      recordCompany?: string;
      recordStage?: string;
      recordOwner?: string;
      recordStatus?: string;
    }) => {
      setPageContext({
        ...pageContext,
        ...data,
      });
    },
  };
}

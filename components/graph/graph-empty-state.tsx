"use client";

import { Network } from "lucide-react";
import { RecordSelector } from "@/components/shared/record-selector";

interface GraphEmptyStateProps {
  onSelect: (result: {
    entityType: string;
    entityId: string;
    displayName: string;
    secondaryText?: string;
  }) => void;
}

export function GraphEmptyState({ onSelect }: GraphEmptyStateProps) {
  return (
    <div className="w-full max-w-[550px] rounded-xl border border-dashed border-white/10 bg-[#0B1120] p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-white/5 text-slate-500 mx-auto">
        <Network className="size-6" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-200">
        Explore your CRM relationships
      </h3>
      <p className="mt-4 text-sm text-slate-400">
        Search for a customer, lead, deal, employee, or activity to begin exploring the knowledge graph.
      </p>
      <div className="mt-4">
        <RecordSelector onSelect={onSelect} placeholder="Search customers, leads, deals..." variant="dark" />
      </div>
    </div>
  );
}

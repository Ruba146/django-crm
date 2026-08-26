"use client";

import { Users, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GraphLandingProps {
  onSelectLeads: () => void;
  onSelectDeals: () => void;
}

export function GraphLanding({ onSelectLeads, onSelectDeals }: GraphLandingProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 text-start transition-all hover:border-cyan-300 hover:bg-gray-50"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition-colors group-hover:bg-cyan-100">
          <Users className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Explore Leads</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Visualize leads and their connections in your CRM.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-gray-200 text-slate-700 hover:bg-gray-50 hover:text-slate-900"
          onClick={onSelectLeads}
        >
          Explore Leads
        </Button>
      </div>

      <div
        className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 text-start transition-all hover:border-purple-300 hover:bg-gray-50"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100">
          <Handshake className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Explore Deals</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Visualize deals and their connections in your CRM.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-gray-200 text-slate-700 hover:bg-gray-50 hover:text-slate-900"
          onClick={onSelectDeals}
        >
          Explore Deals
        </Button>
      </div>
    </div>
  );
}

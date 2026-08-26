"use client";

import { Network, Users, Handshake } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface GraphLandingPageProps {
  leadsHref?: string;
  dealsHref?: string;
}

export function GraphLandingPage({ leadsHref = "/graph/leads", dealsHref = "/graph/deals" }: GraphLandingPageProps) {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Network className="size-6" />
          </div>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Knowledge Graph
        </h1>
        <p className="mt-2 max-w-lg text-base text-muted-foreground">
          Explore relationships between customers, leads, deals, and organizational memory.
        </p>

        <div className="mt-10 grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-pop">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600">
              <Users className="size-6" />
            </div>
            <div className="mt-4 flex-1 text-left">
              <h3 className="text-base font-semibold text-foreground">
                Explore Leads
              </h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Visualize all leads and their connections in your CRM.
              </p>
            </div>
            <div className="mt-5">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => router.push(leadsHref)}
              >
                Explore Leads
              </Button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-pop">
            <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600">
              <Handshake className="size-6" />
            </div>
            <div className="mt-4 flex-1 text-left">
              <h3 className="text-base font-semibold text-foreground">
                Explore Deals
              </h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Visualize all deals and their connections in your CRM.
              </p>
            </div>
            <div className="mt-5">
              <Button
                variant="primary"
                size="md"
                className="w-full bg-orange-600 text-white shadow-soft hover:bg-orange-700 active:bg-orange-800"
                onClick={() => router.push(dealsHref)}
              >
                Explore Deals
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

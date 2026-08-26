"use client";

import { GraphLandingPage } from "@/components/graph/graph-landing-page";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  return <GraphLandingPage leadsHref="/graph/leads" dealsHref="/graph/deals" />;
}

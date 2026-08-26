"use client";

import { GraphView } from "@/components/graph/graph-view";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GraphDealsPage() {
  const router = useRouter();

  return <GraphView initialGraphType="deals" onBack={() => router.push("/graph")} />;
}

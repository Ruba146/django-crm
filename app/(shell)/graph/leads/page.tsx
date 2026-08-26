"use client";

import { GraphView } from "@/components/graph/graph-view";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GraphLeadsPage() {
  const router = useRouter();

  return <GraphView initialGraphType="leads" onBack={() => router.push("/graph")} />;
}

import { Suspense } from "react";
import { DigitalTwinClient } from "./digital-twin-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}

export default async function DigitalTwinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialEntityType = params.entityType ?? "customer";
  const initialEntityId = params.entityId ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Digital Twin</h1>
        <p className="text-muted-foreground">
          Understand the current business state, relationships, decisions, processes, and causal context around a CRM record.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading digital twin...</div>}>
        <DigitalTwinClient initialEntityType={initialEntityType} initialEntityId={initialEntityId} />
      </Suspense>
    </div>
  );
}

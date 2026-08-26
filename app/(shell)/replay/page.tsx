import { ReplayView } from "@/components/replay/replay-view";

export const dynamic = "force-dynamic";

export default function ReplayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Event Replay</h1>
        <p className="text-muted-foreground">
          Trace how any CRM record reached its current state.
        </p>
      </div>
      <ReplayView />
    </div>
  );
}

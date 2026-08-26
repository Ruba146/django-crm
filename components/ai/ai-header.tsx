import { Sparkles } from "lucide-react";

export function AiHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Intelligent insights and recommendations from your CRM data
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Live Analysis
        </span>
      </div>
    </div>
  );
}

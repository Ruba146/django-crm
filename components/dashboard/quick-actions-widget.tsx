import {
  Building2,
  CalendarPlus,
  Handshake,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/utils/cn";

interface QuickAction {
  label: string;
  icon: LucideIcon;
  tint: string;
}

/**
 * Quick actions widget — UI-only shortcut cards. No functionality yet;
 * action handlers will be wired up in later phases (create customer, deal,
 * task, activity).
 */
const ACTIONS: QuickAction[] = [
  {
    label: "Add Customer",
    icon: Building2,
    tint: "bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300",
  },
  {
    label: "Add Deal",
    icon: Handshake,
    tint: "bg-success/10 text-success",
  },
  {
    label: "Create Task",
    icon: CalendarPlus,
    tint: "bg-warning/10 text-warning",
  },
  {
    label: "Create Activity",
    icon: PhoneCall,
    tint: "bg-info/10 text-info",
  },
] as const;

export function QuickActionsWidget() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3 p-5 pt-0">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              aria-label={action.label}
              className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                  action.tint
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

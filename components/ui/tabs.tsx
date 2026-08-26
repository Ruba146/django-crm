"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  listId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs subcomponents must be used within <Tabs>");
  return ctx;
}

export interface TabsProps {
  /** Controlled active tab value. */
  value: string;
  /** Called when the active tab changes. */
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible tabs using the ARIA tabs pattern.
 *
 * Keyboard navigation: ArrowLeft/ArrowRight move between tabs (reversed in
 * RTL via CSS logical order — the arrow handlers use physical keys). Wires
 * `id` / `aria-controls` between trigger and panel using a stable generated id.
 */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const rawId = useId();
  const listId = useMemo(() => `tabs-${rawId.replace(/:/g, "")}`, [rawId]);

  const ctx = useMemo<TabsContextValue>(
    () => ({
      value,
      setValue: onValueChange,
      listId,
    }),
    [value, onValueChange, listId]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  const { listId } = useTabs();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])'
      ) ?? []
    );
    const currentIdx = tabs.findIndex((t) => t === document.activeElement);
    if (currentIdx === -1) return;

    let nextIdx = currentIdx;
    if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else return;

    e.preventDefault();
    tabs[nextIdx]?.focus();
    tabs[nextIdx]?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      id={listId}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({ value, children, disabled, className }: TabsTriggerProps) {
  const { value: active, setValue, listId } = useTabs();
  const selected = active === value;
  const triggerId = `${listId}-trigger-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={selected}
      aria-controls={`${listId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: active, listId } = useTabs();
  const selected = active === value;

  return (
    <div
      role="tabpanel"
      id={`${listId}-panel-${value}`}
      aria-labelledby={`${listId}-trigger-${value}`}
      hidden={!selected}
      className={cn("pt-4", className)}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

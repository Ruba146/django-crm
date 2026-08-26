"use client";

import {
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

export interface TooltipProps {
  /** Label shown in the tooltip. */
  label: ReactNode;
  children: ReactNode;
  /** Placement. */
  side?: "top" | "bottom" | "start" | "end";
  /** Delay before showing in ms. Defaults to 300. */
  delay?: number;
  className?: string;
}

/**
 * Reusable tooltip triggered on hover and keyboard focus.
 *
 * Uses framer-motion for the entrance/exit animation and logical positioning
 * (`start`/`end`) so it flips correctly in RTL layouts.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  delay = 300,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
    timer.current = window.setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setVisible(false);
  };

  const positionCls =
    side === "top"
      ? "bottom-full mb-1.5"
      : side === "bottom"
        ? "top-full mt-1.5"
        : side === "start"
          ? "end-full me-1.5 top-1/2 -translate-y-1/2"
          : "start-full ms-1.5 top-1/2 -translate-y-1/2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {open && visible && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-pop dark:bg-zinc-100 dark:text-zinc-900",
              positionCls,
              className
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

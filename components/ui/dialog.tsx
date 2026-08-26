"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

export interface DialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Dialog title. */
  title: ReactNode;
  /** Optional description under the title. */
  description?: ReactNode;
  /** Optional icon rendered above the title. */
  icon?: ReactNode;
  /** Action buttons (e.g. Confirm / Cancel). */
  footer?: ReactNode;
  /** Whether to close on overlay click or Escape. Defaults to true. */
  dismissible?: boolean;
  /** Width variant. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Reusable confirmation/alert dialog.
 *
 * Distinct from `Modal` (which renders arbitrary content) — Dialog is
 * optimized for confirmations: a title, optional description, optional icon
 * and a footer of actions. Includes keyboard (Escape) and backdrop close,
 * focus trapping and ARIA wiring.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  footer,
  dismissible = true,
  size = "sm",
  className,
}: DialogProps) {
  // Escape to close + lock body scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  const sizeCls =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-2xl"
        : "max-w-lg";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={description ? "dialog-desc" : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "relative z-10 w-full overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-pop",
              sizeCls,
              className
            )}
          >
            <div className="flex flex-col gap-3 p-6">
              {icon && (
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300">
                  {icon}
                </div>
              )}
              <div>
                <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id="dialog-desc" className="mt-1.5 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

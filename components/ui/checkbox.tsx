"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Label rendered beside the checkbox. */
  label?: ReactNode;
  /** Helper/description text below the label. */
  helper?: ReactNode;
  /** Renders the indeterminate visual state. */
  indeterminate?: boolean;
}

/**
 * Reusable, accessible checkbox with label/helper support.
 * Supports dark mode and RTL/LTR via logical Tailwind utilities.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, label, helper, indeterminate, checked, id: idProp, ...props },
    ref
  ) => {
    const autoId = useId();
    const id = idProp ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 text-sm",
            props.disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="relative mt-0.5 flex size-4 shrink-0">
            <input
              ref={ref}
              id={id}
              type="checkbox"
              checked={checked}
              aria-checked={indeterminate ? "mixed" : checked}
              className={cn(
                "peer size-4 cursor-pointer appearance-none rounded border border-input bg-transparent transition-colors",
                "checked:border-primary-600 checked:bg-primary-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed",
                className
              )}
              {...props}
            />
            {/* Check mark */}
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="pointer-events-none absolute inset-0 size-full text-white opacity-0 peer-checked:opacity-100"
            >
              <path
                d="M2.5 6.5 5 9l4.5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="pointer-events-none absolute inset-0 size-full text-white opacity-0 peer-aria-checked:opacity-100"
            >
              <line
                x1="2.5"
                y1="6"
                x2="9.5"
                y2="6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {label && <span className="pt-0.5 leading-snug">{label}</span>}
        </label>
        {helper && (
          <p className="ps-6 text-xs text-muted-foreground" id={`${id}-helper`}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

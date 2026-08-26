"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label rendered above the input. */
  label?: string;
  /** Helper text rendered below the input. */
  helper?: string;
  /** Error message (replaces the helper). */
  error?: string;
  /** Whether the field is required (renders a marker after the label). */
  required?: boolean;
}

/**
 * Reusable, fully-typed text input with label / helper / error support.
 * Error is a string here (not boolean) so it can double as the message,
 * matching the API of Textarea and Select. Supports dark mode and RTL/LTR
 * via logical Tailwind utilities.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helper,
      error,
      required,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    const messageId = `${id}-message`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
            {required && (
              <span aria-hidden className="ms-0.5 text-danger">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? messageId : undefined}
          className={cn(
            "flex h-9 w-full rounded-lg border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger focus-visible:ring-danger" : "border-input",
            className
          )}
          {...props}
        />
        {(error || helper) && (
          <p
            id={messageId}
            className={cn(
              "text-xs",
              error ? "text-danger" : "text-muted-foreground"
            )}
          >
            {error ?? helper}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

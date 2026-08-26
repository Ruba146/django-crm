"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label rendered above the textarea. */
  label?: string;
  /** Helper text below the textarea. */
  helper?: string;
  /** Error message (replaces the helper). */
  error?: string;
  /** Whether the field is required. */
  required?: boolean;
}

/**
 * Reusable, fully-typed textarea with label/error/helper support.
 * Supports dark mode and RTL/LTR via logical Tailwind utilities.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? messageId : undefined}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "resize-y",
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
Textarea.displayName = "Textarea";

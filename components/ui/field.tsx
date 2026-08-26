"use client";

import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "@/utils/cn";

export interface FieldWrapperProps {
  /** Label text rendered above the control. */
  label?: ReactNode;
  /** Short helper text rendered below the control. */
  helper?: ReactNode;
  /** Error message shown instead of the helper text. */
  error?: ReactNode;
  /** Whether the field is required (renders a marker after the label). */
  required?: boolean;
  /** HTML id of the control. Auto-generated when omitted. */
  id?: string;
  /** Direction-aware container classes. */
  className?: string;
  children: ReactNode;
}

export interface FieldContextValue {
  id: string;
  describedBy: string;
  invalid: boolean;
}

/**
 * Shared layout primitive for labelled form controls.
 *
 * Renders a consistent label + control + helper/error stack so every form
 * component (Input, Textarea, Select, Switch, Checkbox, …) shares the same
 * visual language, spacing and ARIA wiring without duplicated code.
 *
 * The `children` receive an implicit context via props (id / describedBy /
 * invalid) so the control can wire up `aria-labelledby` and `aria-invalid`.
 */
export function FieldWrapper({
  label,
  helper,
  error,
  required,
  id: idProp,
  className,
  children,
}: FieldWrapperProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const invalid = Boolean(error);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          id={labelId}
          className="text-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span aria-hidden className="ms-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      {/* Pass wiring to the control via context-to-props is done by the
          consumer; children already bound to id/describedBy/invalid. */}
      {children}
      {(helper || error) && (
        <p
          id={messageId}
          className={cn(
            "text-xs",
            invalid ? "text-danger" : "text-muted-foreground"
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

/** Context object consumers can use to wire up ARIA. */
export function buildFieldContext(
  id: string,
  invalid: boolean
): FieldContextValue {
  return {
    id,
    describedBy: `${id}-message`,
    invalid,
  };
}

export type { HTMLAttributes };

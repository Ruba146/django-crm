"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Label rendered above the select. */
  label?: string;
  /** Helper text below the select. */
  helper?: string;
  /** Error message (replaces the helper). */
  error?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Options to render inside the <select>. */
  options?: SelectOption[];
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** Direction-aware container classes. */
  className?: string;
}

/**
 * Reusable, fully-typed select control built on the native <select> for
 * accessibility. Supports label/error/helper, options, dark mode and RTL.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      helper,
      error,
      required,
      options = [],
      placeholder,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    const messageId = `${id}-message`;
    const hasSelection = props.value !== "" && props.value != null;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helper ? messageId : undefined}
            className={cn(
              "w-full cursor-pointer appearance-none rounded-lg border bg-transparent py-2 pe-9 ps-3 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !hasSelection && "text-muted-foreground",
              error ? "border-danger focus-visible:ring-danger" : "border-input",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          {/* RTL-aware chevron on the end side */}
          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground rtl:rotate-180" />
        </div>
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
Select.displayName = "Select";

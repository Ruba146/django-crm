"use client";

import { forwardRef, useId, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Whether the switch is on. */
  checked: boolean;
  /** Called when the switch toggles. */
  onCheckedChange: (checked: boolean) => void;
  /** Label rendered beside the switch. */
  label?: string;
  /** Helper/description text below the switch. */
  helper?: string;
}

/**
 * Reusable, accessible switch (toggle) control.
 * Built on a <button role="switch"> for keyboard + screen-reader support.
 * Supports dark mode and RTL/LTR via logical Tailwind utilities.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      label,
      helper,
      disabled,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = idProp ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 text-sm",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <button
            ref={ref}
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              checked ? "border-primary-600 bg-primary-600" : "border-input bg-muted",
              className
            )}
            {...props}
          >
            <span
              className={cn(
                "pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform rtl:flex-row-reverse",
                checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5"
              )}
            />
          </button>
          {label && <span className="pt-0.5 leading-snug">{label}</span>}
        </label>
        {helper && (
          <p className="ps-11 text-xs text-muted-foreground" id={`${id}-helper`}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);
Switch.displayName = "Switch";

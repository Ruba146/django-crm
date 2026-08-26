"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  /** Controlled query value. */
  value: string;
  /** Called when the query changes (debounced per `debounceMs`). */
  onChange: (value: string) => void;
  /** Debounce delay in ms. Defaults to 250. */
  debounceMs?: number;
  /** Placeholder text. */
  placeholder?: string;
  /** Optional label above the input. */
  label?: string;
  /** Height variant. */
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable search input with a leading search icon and a clear button.
 *
 * The value is controlled and `onChange` is debounced so callers can wire it
 * to a filtering hook (e.g. useTableFiltering) without per-keystroke work.
 * RTL-aware via logical utilities.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onChange,
      debounceMs = 250,
      placeholder,
      label,
      size = "md",
      id,
      ...props
    },
    ref
  ) => {
    const [internal, setInternal] = useState(value);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Sync when the external value changes from outside.
    useEffect(() => {
      setInternal(value);
    }, [value]);

    const handleChange = useCallback(
      (next: string) => {
        setInternal(next);
        const timer = window.setTimeout(() => onChangeRef.current(next), debounceMs);
        return () => window.clearTimeout(timer);
      },
      [debounceMs]
    );

    const showClear = internal.length > 0;

    const sizeCls =
      size === "sm"
        ? "h-8"
        : size === "lg"
          ? "h-11 text-base"
          : "h-9";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className={cn("relative", sizeCls)}>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={ref}
            id={id}
            value={internal}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full rounded-lg border border-input bg-transparent py-2 pe-9 ps-9 text-sm shadow-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
          {showClear && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => handleChange("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

import { useMemo, type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  fallback?: string;
  /** Skip the automatic color sizing and use the default purple tint. */
  noAutoColor?: boolean;
}

const sizes: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-11 text-base",
  xl: "size-16 text-2xl",
};

/** Deterministic palette of tint pairs for the automatic fallback color. */
const FALLBACK_PALETTE = [
  ["bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300"],
  ["bg-info/10 text-info"],
  ["bg-success/10 text-success"],
  ["bg-warning/10 text-warning"],
  ["bg-danger/10 text-danger"],
] as const;

/** Extract initials from a person's name. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Hash a string into a stable palette index. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function Avatar({
  className,
  src,
  alt,
  name,
  size = "md",
  fallback,
  noAutoColor,
  ...props
}: AvatarProps) {
  const text = fallback ?? (name ? initials(name) : "?");

  // Stable color derived from the name/fallback so the same person always
  // gets the same tint across the app.
  const autoTint = useMemo(() => {
    if (noAutoColor) return null;
    const seed = name ?? text;
    return FALLBACK_PALETTE[hashString(seed) % FALLBACK_PALETTE.length][0];
  }, [name, text, noAutoColor]);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-border",
        autoTint ??
          "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300",
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? name ?? "avatar"}
          className="size-full object-cover"
        />
      ) : (
        <span className="select-none">{text}</span>
      )}
    </span>
  );
}

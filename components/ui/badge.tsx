import { type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary"
  | "outline"
  | "danger-solid";

/** Backwards-compatible aliases. */
export type LegacyBadgeVariant = "default" | "secondary";

export type BadgeVariantOrLegacy = BadgeVariant | LegacyBadgeVariant;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-600 text-white",
  outline: "border border-border bg-transparent text-foreground",
  "danger-solid": "bg-danger text-white",
};

const legacyVariants: Record<LegacyBadgeVariant, string> = {
  default: variants.primary,
  secondary: variants.neutral,
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant] ??
          legacyVariants[variant as LegacyBadgeVariant],
        className
      )}
      {...props}
    />
  );
}

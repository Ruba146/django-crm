/**
 * Formatting helpers shared across the CRM.
 * Kept pure and locale-aware for English LTR and Arabic RTL support.
 */

/** Format a number as a localized string. */
export function formatNumber(value: number, locale = "en"): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Format a date using the given locale. */
export function formatDate(
  value: string | Date | null | undefined,
  locale = "en"
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Format a date-time using the given locale. */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale = "en"
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Convert a minor (integer) currency amount stored in the database
 * into a localized currency string. The DB stores amounts in "minor"
 * units (e.g. cents / halalas).
 */
export function formatCurrency(
  minor: number | null | undefined,
  currencyCode = "SAR",
  locale = "en"
): string {
  if (minor === null || minor === undefined) return "—";
  const value = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

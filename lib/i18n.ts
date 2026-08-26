import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export type Locale = keyof typeof messages;
export type Messages = typeof en;

export const messages = { en, ar } as const;

/**
 * Resolve nested translation keys, e.g. `t("nav.dashboard")`.
 * Optional fallback returned when the key is missing.
 */
export function translate(
  locale: Locale,
  key: string,
  fallback?: string
): string {
  const dict: unknown = messages[locale] ?? en;
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : fallback ?? key;
}

/** Get the translated dict for a locale. */
export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? en;
}

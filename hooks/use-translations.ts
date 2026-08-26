"use client";

import { useCallback } from "react";
import { translate, type Locale } from "@/lib/i18n";
import { useLanguageStore } from "@/stores/language-store";

/**
 * Client-side translation hook.
 * Returns a `t(key, fallback?)` function bound to the active locale.
 */
export function useTranslations() {
  const locale = useLanguageStore((s) => s.locale);
  const t = useCallback(
    (key: string, fallback?: string) => translate(locale as Locale, key, fallback),
    [locale]
  );
  return { t, locale };
}

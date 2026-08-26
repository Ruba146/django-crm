"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "ar";

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** true when the current locale is Arabic (right-to-left). */
  isRTL: boolean;
}

/**
 * Language store — controls English (LTR) / Arabic (RTL).
 * Persisted to localStorage. Used by the topbar language switch,
 * the root layout (dir attribute) and providers.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: "en",
      isRTL: false,
      setLocale: (locale) => set({ locale, isRTL: locale === "ar" }),
    }),
    {
      name: "crm-language",
    }
  )
);

/** Convenience hook returning just the RTL flag. */
export const useIsRTL = () =>
  useLanguageStore((s) => s.locale === "ar");

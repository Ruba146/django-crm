"use client";

import { useLanguageStore } from "@/stores/language-store";

/** Returns true when the active locale is Arabic (RTL). */
export function useIsRTL(): boolean {
  return useLanguageStore((s) => s.locale === "ar");
}

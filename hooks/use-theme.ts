"use client";

import { useEffect } from "react";
import { useThemeStore, type Theme } from "@/stores/theme-store";

/**
 * Applies the active theme to the document root element.
 * Also keeps `system` in sync with OS preference changes.
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const isDark =
        theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", isDark);
    };

    apply();

    if (theme === "system") {
      const handler = () => apply();
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, [theme]);

  return theme;
}

export type { Theme };

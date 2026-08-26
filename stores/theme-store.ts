"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

/**
 * Theme store — controls light / dark / system.
 * Persisted to localStorage via zustand/middleware.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggle: () => {
        const next: Theme =
          get().theme === "dark"
            ? "light"
            : get().theme === "light"
              ? "dark"
              : typeof window !== "undefined" &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "light"
                : "dark";
        set({ theme: next });
      },
    }),
    {
      name: "crm-theme",
    }
  )
);

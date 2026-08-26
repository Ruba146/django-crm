"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useLanguageStore } from "@/stores/language-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  useTheme();
  const locale = useLanguageStore((s) => s.locale);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    root.setAttribute("lang", locale);
  }, [locale]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

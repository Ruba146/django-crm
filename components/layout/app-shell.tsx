import type { ReactNode } from "react";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AICopilotProvider } from "@/components/ai/copilot";
import { PageContextDetector } from "@/components/ai/copilot/page-context";

export function AppShell({ children, fullHeight, noPadding }: { children: ReactNode; fullHeight?: boolean; noPadding?: boolean }) {
  return (
    <AICopilotProvider>
      <Suspense fallback={null}>
        <PageContextDetector />
      </Suspense>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className={`flex min-w-0 flex-1 flex-col ${fullHeight ? "h-screen" : ""}`}>
          <Topbar />
          <main
            className={`flex-1 overflow-x-hidden ${
              fullHeight
                ? ""
                : "overflow-y-auto py-6"
            } ${noPadding ? "p-0" : "px-4 lg:px-6"}`}
          >
            <div
              className={`mx-auto flex h-full w-full ${
                fullHeight ? "" : "max-w-7xl"
              }`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </AICopilotProvider>
  );
}

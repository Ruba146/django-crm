"use client";

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatWindow } from "./chat-window";
import { FloatingAIButton } from "./floating-ai-button";
import { useAICopilotStore } from "@/stores/ai-copilot-store";

export function AICopilotProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useAICopilotStore();

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  return (
    <>
      {children}
      <FloatingAIButton />

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={handleBackdropClick}
            />
            <ChatWindow />
          </>
        )}
      </AnimatePresence>
    </>
  );
}

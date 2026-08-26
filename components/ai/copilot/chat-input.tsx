"use client";

import { useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/utils/cn";
import { useTranslations } from "@/hooks/use-translations";
import { useAICopilotStore } from "@/stores/ai-copilot-store";
import { VoiceButton } from "./voice-button";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";

export function ChatInput({
  onSend,
  disabled,
  placeholder,
  locale,
  className,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  locale?: string;
  className?: string;
}) {
  const { t } = useTranslations();
  const isTyping = useAICopilotStore((s) => s.isTyping);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    status: voiceStatus,
    transcript,
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceAssistant({
    locale: locale || "en",
    onResult: (text) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      }
    },
  });

  useEffect(() => {
    if (!isRecording && transcript && textareaRef.current) {
      const el = textareaRef.current;
      if (!el.value) {
        el.value = transcript;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      }
    }
  }, [isRecording, transcript]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text || disabled || isTyping) return;
    el.value = "";
    el.style.height = "auto";
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex items-end gap-2 border-t border-border bg-card p-3", className)}
    >
      <VoiceButton
        status={voiceStatus}
        transcript={transcript}
        onStart={startRecording}
        onStop={stopRecording}
        onCancel={cancelRecording}
        disabled={disabled || isTyping}
      />

      <textarea
        ref={textareaRef}
        rows={1}
        disabled={disabled || isTyping}
        placeholder={placeholder ?? t("copilot.typeMessage")}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[40px] max-h-[160px]"
        )}
      />
      <button
        type="submit"
        disabled={disabled || isTyping}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors",
          "hover:bg-primary-700 active:bg-primary-800",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        )}
        aria-label={t("copilot.send")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M22 2 11 13" />
          <path d="m22 2-7 20-4-9-9-4z" />
        </svg>
      </button>
    </form>
  );
}


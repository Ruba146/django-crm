"use client";

import { useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export function VoiceButton({
  status,
  transcript,
  onStart,
  onStop,
  onCancel,
  disabled,
  className,
}: {
  status: "idle" | "requesting" | "recording" | "processing" | "error" | "unsupported";
  transcript: string;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const isRecording = status === "recording";
  const isRequesting = status === "requesting";

  const handleClick = useCallback(() => {
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  }, [isRecording, onStart, onStop]);

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      {isRecording && (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Cancel recording"
          title="Cancel"
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
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || status === "unsupported" || status === "processing"}
        className={cn(
          "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isRecording
            ? "bg-danger text-white hover:bg-danger/90 animate-pulse"
            : "bg-muted text-foreground hover:bg-accent hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        aria-label={isRecording ? "Stop recording" : "Start voice input"}
        title={isRecording ? "Stop recording" : "Voice input"}
      >
        {isRequesting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}

        {isRecording && (
          <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
          </span>
        )}
      </button>

      {isRecording && transcript && (
        <span className="max-w-[160px] truncate text-xs text-muted-foreground">
          {transcript}
        </span>
      )}
    </div>
  );
}

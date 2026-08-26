"use client";

import { useMemo } from "react";
import { Play, Pause, Square, Settings2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { VoiceSettings } from "@/types/ai-chat";

export function VoiceSettings({
  settings,
  onUpdate,
  voices,
  status,
  onSpeak,
  onPause,
  onResume,
  onStop,
  locale = "en",
  className,
}: {
  settings: VoiceSettings;
  onUpdate: (partial: Partial<VoiceSettings>) => void;
  voices: SpeechSynthesisVoice[];
  status: string;
  onSpeak: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  locale?: string;
  className?: string;
}) {

  const filteredVoices = useMemo(() => {
    if (locale === "ar") {
      return voices.filter((v) => v.lang.startsWith("ar"));
    }
    return voices;
  }, [voices, locale]);

  const handleToggle = () => {
    onUpdate({ enabled: !settings.enabled });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Voice Output</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            settings.enabled ? "bg-primary-600" : "bg-muted"
          )}
          aria-pressed={settings.enabled}
          title={settings.enabled ? "Disable voice output" : "Enable voice output"}
        >
          <span
            className={cn(
              "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
              settings.enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Voice</label>
            <select
              value={settings.voice}
              onChange={(e) => onUpdate({ voice: e.target.value })}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Default</option>
              {filteredVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Speed: {settings.speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.speed}
              onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
              className="w-full accent-primary-600"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSpeak("This is a test of the voice output system.")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-xs text-white transition-colors hover:bg-primary-700"
            >
              <Play className="size-3.5" />
              Test
            </button>

            {status === "playing" && (
              <button
                type="button"
                onClick={onPause}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs transition-colors hover:bg-accent"
              >
                <Pause className="size-3.5" />
                Pause
              </button>
            )}

            {status === "paused" && (
              <button
                type="button"
                onClick={onResume}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs transition-colors hover:bg-accent"
              >
                <Play className="size-3.5" />
                Resume
              </button>
            )}

            {(status === "playing" || status === "paused") && (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger/10 px-3 text-xs text-danger transition-colors hover:bg-danger/20"
              >
                <Square className="size-3.5" />
                Stop
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

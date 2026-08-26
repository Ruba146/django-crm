"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceSettings {
  enabled: boolean;
  voice: string;
  speed: number;
  autoRead: boolean;
}

type PlaybackStatus = "idle" | "playing" | "paused" | "stopped";

interface UseVoiceOutputOptions {
  settings?: VoiceSettings;
  onStatusChange?: (status: PlaybackStatus) => void;
}

interface UseVoiceOutputReturn {
  status: PlaybackStatus;
  voices: SpeechSynthesisVoice[];
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  settings: VoiceSettings;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: false,
  voice: "",
  speed: 1,
  autoRead: false,
};

export function useVoiceOutput(
  options: UseVoiceOutputOptions = {}
): UseVoiceOutputReturn {
  const { settings: initialSettings, onStatusChange } = options;

  const [settings, setSettings] = useState<VoiceSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTextRef = useRef("");

  const notifyStatus = useCallback(
    (newStatus: PlaybackStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!settings.enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!text || !text.trim()) return;

      window.speechSynthesis.cancel();
      currentTextRef.current = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      const selectedVoice = settings.voice
        ? voices.find((v) => v.name === settings.voice)
        : null;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = settings.speed;
      utterance.lang = selectedVoice
        ? selectedVoice.lang
        : settings.voice
          ? (voices.find((v) => v.name === settings.voice)?.lang ?? "en-US")
          : "en-US";

      utterance.onstart = () => notifyStatus("playing");
      utterance.onend = () => notifyStatus("stopped");
      utterance.onerror = () => notifyStatus("stopped");
      utterance.onpause = () => notifyStatus("paused");
      utterance.onresume = () => notifyStatus("playing");

      window.speechSynthesis.speak(utterance);
    },
    [settings.enabled, settings.voice, settings.speed, voices, notifyStatus]
  );

  const pause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      notifyStatus("paused");
    }
  }, [notifyStatus]);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      notifyStatus("playing");
    }
  }, [notifyStatus]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      notifyStatus("stopped");
    }
  }, [notifyStatus]);

  const updateSettings = useCallback((partial: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (!partial.enabled && prev.enabled) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        notifyStatus("idle");
      }
      return next;
    });
  }, [notifyStatus]);

  return {
    status,
    voices,
    speak,
    pause,
    resume,
    stop,
    updateSettings,
    settings,
  };
}

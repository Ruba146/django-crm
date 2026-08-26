"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionStatus = "idle" | "requesting" | "recording" | "processing" | "error" | "unsupported";

interface UseVoiceAssistantOptions {
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  locale?: string;
}

interface UseVoiceAssistantReturn {
  status: RecognitionStatus;
  transcript: string;
  isRecording: boolean;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  isSupported: boolean;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
  prototype: SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceAssistant(
  options: UseVoiceAssistantOptions = {}
): UseVoiceAssistantReturn {
  const { onResult, onError, lang, continuous = false, interimResults = true, locale = "en" } = options;

  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");
  const statusRef = useRef<RecognitionStatus>("idle");

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const resolvedLang = lang || (locale === "ar" ? "ar-SA" : "en-US");

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setStatus("unsupported");
      setError("Speech recognition is not supported in this browser.");
      onError?.("Speech recognition is not supported in this browser.");
      return;
    }

    cleanup();
    setError(null);
    setTranscript("");
    finalTranscriptRef.current = "";
    setStatus("requesting");

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setStatus("unsupported");
      setError("Speech recognition API not available.");
      onError?.("Speech recognition API not available.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = resolvedLang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("recording");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptPart;
        } else {
          interim += transcriptPart;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
      }

      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setStatus("idle");
        setTranscript("");
        return;
      }
      const message = `Speech recognition error: ${event.error}`;
      setStatus("error");
      setError(message);
      onError?.(message);
    };

    recognition.onend = () => {
      const currentStatus = statusRef.current;
      if (currentStatus === "recording" || currentStatus === "processing") {
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          setTranscript(finalText);
          onResult?.(finalText);
        }
        setStatus("idle");
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setStatus("error");
      setError("Failed to start speech recognition.");
      onError?.("Failed to start speech recognition.");
    }
  }, [isSupported, resolvedLang, continuous, interimResults, onResult, onError, cleanup]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && statusRef.current === "recording") {
      setStatus("processing");
      recognitionRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cleanup();
    finalTranscriptRef.current = "";
    setTranscript("");
    setStatus("idle");
  }, [cleanup]);

  return {
    status,
    transcript,
    isRecording: status === "recording",
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
  };
}

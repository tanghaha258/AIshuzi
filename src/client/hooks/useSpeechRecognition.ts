import { useCallback, useMemo, useRef, useState } from "react";
import type { TranscriptSegment } from "../../shared/types";

type SpeechRecognitionConstructor = new () => SpeechRecognition;
type SpeechRecognitionStatus = "idle" | "listening" | "unsupported" | "blocked" | "error";
type SpeechSegmentDraft = Omit<TranscriptSegment, "sessionId"> & { sessionId?: string };

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex?: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}

interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function createSegmentId() {
  return globalThis.crypto?.randomUUID?.() ?? `speech-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function performanceNow() {
  return Math.round(globalThis.performance?.now?.() ?? Date.now());
}

export function useSpeechRecognition(onSegment: (segment: SpeechSegmentDraft) => void) {
  const [status, setStatus] = useState<SpeechRecognitionStatus>(() =>
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) ? "idle" : "unsupported"
  );
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastFinalOffsetRef = useRef(0);

  const supported = useMemo(
    () => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const buildRecognition = useCallback(() => {
    const SpeechApi = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechApi) return null;
    const recognition = new SpeechApi();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const resultIndex = event.resultIndex ?? 0;
      for (let index = resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        const text = alternative?.transcript?.trim();
        if (!text) continue;
        const endOffsetMs = Math.max(0, performanceNow() - startedAtRef.current);
        const startOffsetMs = result.isFinal
          ? lastFinalOffsetRef.current
          : Math.max(lastFinalOffsetRef.current, endOffsetMs - 1600);
        if (result.isFinal) {
          lastFinalOffsetRef.current = endOffsetMs;
        }
        onSegment({
          id: createSegmentId(),
          text,
          isFinal: result.isFinal,
          source: "web-speech",
          confidence: typeof alternative.confidence === "number" ? alternative.confidence : result.isFinal ? 0.86 : 0,
          startOffsetMs,
          endOffsetMs,
          language: recognition.lang,
          createdAt: new Date().toISOString()
        });
      }
    };
    recognition.onerror = (event) => {
      const message = event.message || event.error || "语音识别失败。";
      setError(message);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setStatus("blocked");
      } else {
        setStatus("error");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!shouldListenRef.current) {
        setStatus(supported ? "idle" : "unsupported");
        return;
      }
      window.setTimeout(() => {
        if (!shouldListenRef.current) return;
        const nextRecognition = buildRecognition();
        if (!nextRecognition) {
          setStatus("unsupported");
          return;
        }
        recognitionRef.current = nextRecognition;
        try {
          nextRecognition.start();
          setStatus("listening");
        } catch {
          setStatus("error");
          setError("语音识别启动失败，请重试。");
        }
      }, 180);
    };
    return recognition;
  }, [onSegment, supported]);

  const start = useCallback(() => {
    if (!supported) {
      setStatus("unsupported");
      return false;
    }
    const recognition = buildRecognition();
    if (!recognition) {
      setStatus("unsupported");
      return false;
    }
    shouldListenRef.current = true;
    startedAtRef.current = performanceNow();
    lastFinalOffsetRef.current = 0;
    setError("");
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
      return true;
    } catch {
      shouldListenRef.current = false;
      setStatus("error");
      setError("语音识别启动失败，请重试。");
      return false;
    }
  }, [buildRecognition, supported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus(supported ? "idle" : "unsupported");
  }, [supported]);

  return {
    supported,
    listening: status === "listening",
    status,
    error,
    start,
    stop
  };
}

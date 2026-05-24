import { useCallback, useMemo, useState } from "react";
import type { TranscriptSegment } from "../../shared/types";

type TranscriptSegmentDraft = Omit<TranscriptSegment, "sessionId"> & { sessionId?: string };

function segmentWithSession(sessionId: string, segment: TranscriptSegmentDraft): TranscriptSegment {
  return {
    id: segment.id,
    sessionId,
    text: segment.text.trim(),
    isFinal: segment.isFinal,
    source: segment.source,
    confidence: segment.confidence,
    startOffsetMs: segment.startOffsetMs,
    endOffsetMs: segment.endOffsetMs,
    language: segment.language || "zh-CN",
    createdAt: segment.createdAt
  };
}

export function useTranscriptBuffer(sessionId: string) {
  const [interimText, setInterimText] = useState("");
  const [finalSegments, setFinalSegments] = useState<TranscriptSegment[]>([]);
  const [lastError, setLastError] = useState("");

  const acceptSegment = useCallback((segment: TranscriptSegmentDraft) => {
    if (!segment.text.trim()) return;
    const next = segmentWithSession(sessionId, segment);
    if (next.isFinal) {
      setFinalSegments((current) => [...current, next]);
      setInterimText("");
      return;
    }
    setInterimText(next.text);
  }, [sessionId]);

  const flushFinalSegments = useCallback(() => {
    const flushed = finalSegments;
    setFinalSegments([]);
    setInterimText("");
    return flushed;
  }, [finalSegments]);

  const clearTranscript = useCallback(() => {
    setInterimText("");
    setFinalSegments([]);
    setLastError("");
  }, []);

  const finalText = useMemo(
    () => finalSegments.map((segment) => segment.text).join(" ").trim(),
    [finalSegments]
  );

  return {
    interimText,
    finalSegments,
    finalText,
    lastError,
    acceptSegment,
    flushFinalSegments,
    clearTranscript,
    setLastError
  };
}

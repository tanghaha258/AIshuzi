import { randomUUID } from "node:crypto";
import type { ClassroomEvent, TranscriptSegment, TranscriptSource } from "../../shared/types.js";

const transcriptSources: TranscriptSource[] = ["web-speech", "manual", "local-asr"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function numberOr(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSource(value: unknown): TranscriptSource {
  return transcriptSources.includes(value as TranscriptSource) ? value as TranscriptSource : "manual";
}

export function normalizeTranscriptSegment(input: Partial<TranscriptSegment>): TranscriptSegment {
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  if (!sessionId) {
    throw new Error("转写片段缺少 sessionId。");
  }

  const text = typeof input.text === "string" ? input.text.trim().replace(/\s+/g, " ") : "";
  if (!text) {
    throw new Error("转写文本不能为空。");
  }

  const startOffsetMs = Math.max(0, Math.round(numberOr(input.startOffsetMs, 0)));
  const rawEndOffsetMs = Math.max(0, Math.round(numberOr(input.endOffsetMs, startOffsetMs)));
  const endOffsetMs = Math.max(startOffsetMs, rawEndOffsetMs);
  const language = typeof input.language === "string" && input.language.trim() ? input.language.trim() : "zh-CN";

  return {
    id: input.id?.trim() || randomUUID(),
    sessionId,
    text,
    isFinal: Boolean(input.isFinal),
    source: normalizeSource(input.source),
    confidence: clamp(numberOr(input.confidence, 0), 0, 1),
    startOffsetMs,
    endOffsetMs,
    language,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function createTranscriptEvent(
  sessionId: string,
  segment: TranscriptSegment
): Omit<ClassroomEvent, "id" | "timestamp"> {
  const normalized = normalizeTranscriptSegment({ ...segment, sessionId });
  return {
    sessionId,
    type: "transcript_segment",
    actor: normalized.source === "manual" ? "手动转写" : "语音转写",
    content: normalized.text,
    metadata: {
      transcriptId: normalized.id,
      isFinal: normalized.isFinal,
      source: normalized.source,
      confidence: normalized.confidence,
      startOffsetMs: normalized.startOffsetMs,
      endOffsetMs: normalized.endOffsetMs,
      language: normalized.language
    }
  };
}

export function mergeTranscriptSegments(segments: TranscriptSegment[]) {
  return segments
    .filter((segment) => segment.isFinal)
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

import assert from "node:assert/strict";
import {
  createTranscriptEvent,
  mergeTranscriptSegments,
  normalizeTranscriptSegment
} from "../src/server/services/transcriptService.js";

const normalized = normalizeTranscriptSegment({
  sessionId: "session-1",
  text: "  同学们，我们先看这个问题。  ",
  isFinal: true,
  source: "web-speech",
  confidence: 1.4,
  startOffsetMs: -30,
  endOffsetMs: 1200,
  language: "zh-CN"
});

assert.equal(normalized.sessionId, "session-1");
assert.equal(normalized.text, "同学们，我们先看这个问题。");
assert.equal(normalized.isFinal, true);
assert.equal(normalized.source, "web-speech");
assert.equal(normalized.confidence, 1);
assert.equal(normalized.startOffsetMs, 0);
assert.equal(normalized.endOffsetMs, 1200);
assert.equal(normalized.language, "zh-CN");
assert.ok(normalized.createdAt);

const swappedOffsets = normalizeTranscriptSegment({
  sessionId: "session-1",
  text: "第二句",
  isFinal: false,
  source: "manual",
  confidence: -1,
  startOffsetMs: 900,
  endOffsetMs: 100,
  language: ""
});
assert.equal(swappedOffsets.confidence, 0);
assert.equal(swappedOffsets.startOffsetMs, 900);
assert.equal(swappedOffsets.endOffsetMs, 900);
assert.equal(swappedOffsets.language, "zh-CN");

assert.throws(
  () => normalizeTranscriptSegment({ sessionId: "session-1", text: "   ", isFinal: true }),
  /转写文本不能为空/
);
assert.throws(
  () => normalizeTranscriptSegment({ sessionId: "", text: "有效文本", isFinal: true }),
  /sessionId/
);

const event = createTranscriptEvent("session-1", normalized);
assert.equal(event.sessionId, "session-1");
assert.equal(event.type, "transcript_segment");
assert.equal(event.actor, "语音转写");
assert.equal(event.content, "同学们，我们先看这个问题。");
assert.deepEqual(event.metadata, {
  transcriptId: normalized.id,
  isFinal: true,
  source: "web-speech",
  confidence: 1,
  startOffsetMs: 0,
  endOffsetMs: 1200,
  language: "zh-CN"
});

const merged = mergeTranscriptSegments([
  normalized,
  { ...normalized, id: "interim", text: "还没定稿", isFinal: false },
  { ...normalized, id: "final-2", text: "谁能说说第一步？", isFinal: true, startOffsetMs: 1200, endOffsetMs: 2600 }
]);
assert.equal(merged, "同学们，我们先看这个问题。 谁能说说第一步？");

console.log("Transcript contract passed.");

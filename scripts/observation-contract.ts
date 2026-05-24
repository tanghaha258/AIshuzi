import assert from "node:assert/strict";
import {
  buildTeacherObservationEvents,
  normalizeTeacherObservation
} from "../src/server/services/observationService.js";

const fixedNow = new Date("2026-05-24T08:00:00.000Z");
const now = () => fixedNow;

const validObservation = {
  source: "mediapipe",
  faceVisible: true,
  faceConfidence: 74,
  headDirection: "front",
  expressionActivity: 42,
  stability: 80,
  capturedAt: "2026-05-24T07:59:50.000Z"
};

const normalized = normalizeTeacherObservation({
  source: "mediapipe",
  faceVisible: true,
  faceConfidence: 128,
  headDirection: "left",
  expressionActivity: -12,
  stability: 88.6,
  capturedAt: "2026-05-24T07:59:50.000Z"
}, { now });

assert.equal(normalized.source, "mediapipe");
assert.equal(normalized.faceVisible, true);
assert.equal(normalized.faceConfidence, 100);
assert.equal(normalized.headDirection, "left");
assert.equal(normalized.expressionActivity, 0);
assert.equal(normalized.stability, 89);
assert.equal(normalized.capturedAt, "2026-05-24T07:59:50.000Z");

const observation = buildTeacherObservationEvents("session-1", normalized, { now });
assert.equal(observation.observationEvent.sessionId, "session-1");
assert.equal(observation.observationEvent.type, "teacher_observation");
assert.equal(observation.observationEvent.actor, "教师观察");
assert.match(observation.observationEvent.content, /教师观察/);
assert.deepEqual(observation.observationEvent.metadata.observation, normalized);
assert.equal(observation.suggestionEvent, undefined);

const issue = buildTeacherObservationEvents("session-1", {
  source: "fallback",
  faceVisible: false,
  faceConfidence: 15,
  headDirection: "down",
  expressionActivity: 5,
  stability: 22,
  capturedAt: "2026-05-24T07:59:55.000Z"
}, { now });

assert.equal(issue.suggestionEvent?.type, "system_suggestion");
assert.equal(issue.suggestionEvent?.actor, "系统建议");
assert.match(issue.suggestionEvent?.content ?? "", /摄像头|画面|稳定/);

assert.throws(
  () => buildTeacherObservationEvents("", normalized, { now }),
  /sessionId/
);

assert.throws(
  () => normalizeTeacherObservation({}, { now }),
  /缺少观察字段/
);

const { stability, ...missingStability } = validObservation;
void stability;
assert.throws(
  () => normalizeTeacherObservation(missingStability, { now }),
  /缺少观察字段/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, source: "unknown" }, { now }),
  /source/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, faceVisible: "yes" }, { now }),
  /faceVisible/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, faceConfidence: Number.NaN }, { now }),
  /faceConfidence/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, headDirection: "sideways" }, { now }),
  /headDirection/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, capturedAt: "not-a-date" }, { now }),
  /capturedAt/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, debug: true }, { now }),
  /不支持的观察字段/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, landmarks: [] }, { now }),
  /不支持的观察字段/
);

assert.throws(
  () => normalizeTeacherObservation({ ...validObservation, faceBox: { x: 1 } }, { now }),
  /不支持的观察字段/
);

assert.throws(
  () => buildTeacherObservationEvents("session-1", {
    ...normalized,
    videoFrame: "data:image/png;base64,abc"
  } as unknown as Record<string, unknown>, { now }),
  /不接收图片或视频/
);

console.log("Observation contract passed.");

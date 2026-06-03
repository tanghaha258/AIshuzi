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
assert.match(observation.suggestionEvent?.content ?? "", /视线|学生区|偏离镜头/);

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
assert.match(issue.suggestionEvent?.content ?? "", /镜头中央|补足光线|观察建议|可靠/);
assert.doesNotMatch(issue.suggestionEvent?.content ?? "", /抬头|手势|固定站位/);

function suggestionFor(input: typeof validObservation) {
  return buildTeacherObservationEvents("session-1", input, { now }).suggestionEvent?.content ?? "";
}

const lowConfidenceAdvice = suggestionFor({
  ...validObservation,
  faceVisible: false,
  faceConfidence: 18,
  headDirection: "down",
  expressionActivity: 6,
  stability: 20
});
assert.match(lowConfidenceAdvice, /镜头中央|补足光线|观察建议|可靠/);
assert.doesNotMatch(lowConfidenceAdvice, /抬头|手势|站位/);

const downAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
});
assert.match(downAdvice, /抬头|学生区|下一轮提问|复述/);

const downAdviceEvent = buildTeacherObservationEvents("session-1", {
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
}, { now }).suggestionEvent;
assert.equal(downAdviceEvent?.metadata.source, "teacher_observation");
assert.equal(downAdviceEvent?.metadata.adviceLabel, "look-up-before-question");
assert.equal(downAdviceEvent?.metadata.advicePriority, 2);
assert.deepEqual(downAdviceEvent?.metadata.observation, {
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
});

const sideAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "left",
  expressionActivity: 50,
  stability: 74
});
assert.match(sideAdvice, /视线|学生区|偏离镜头/);

const unstableAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "front",
  expressionActivity: 50,
  stability: 21
});
assert.match(unstableAdvice, /固定站位|设备|继续讲解|数据失真/);

const lowExpressionAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "front",
  expressionActivity: 12,
  stability: 74
});
assert.match(lowExpressionAdvice, /关键概念|停顿|重音|手势/);

const healthyAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 86,
  headDirection: "front",
  expressionActivity: 55,
  stability: 76
});
assert.equal(healthyAdvice, "");

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

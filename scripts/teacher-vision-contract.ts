import assert from "node:assert/strict";
import { deriveTeacherObservation } from "../src/client/utils/teacherVision";

const landmarks = Array.from({ length: 300 }, () => ({ x: 0.5, y: 0.5 }));
landmarks[1] = { x: 0.62, y: 0.56 };
landmarks[33] = { x: 0.38, y: 0.42 };
landmarks[263] = { x: 0.62, y: 0.42 };

const visible = deriveTeacherObservation({
  faceLandmarks: [landmarks],
  faceBlendshapes: [{
    categories: [
      { categoryName: "mouthSmileLeft", score: 0.76 },
      { categoryName: "jawOpen", score: 0.18 }
    ]
  }]
}, "2026-05-24T09:00:00.000Z", { x: 0.51, y: 0.49 });

assert.equal(visible.payload.source, "mediapipe");
assert.equal(visible.payload.faceVisible, true);
assert.equal(visible.payload.faceConfidence, 96);
assert.equal(visible.payload.headDirection, "right");
assert.equal(visible.payload.expressionActivity, 76);
assert.ok(visible.payload.stability >= 70);
assert.deepEqual(visible.faceCenter, { x: 0.5, y: 0.5 });

const noFace = deriveTeacherObservation({
  faceLandmarks: [],
  faceBlendshapes: []
}, "2026-05-24T09:00:02.000Z");

assert.equal(noFace.payload.faceVisible, false);
assert.equal(noFace.payload.faceConfidence, 0);
assert.equal(noFace.payload.headDirection, "unknown");
assert.equal(noFace.payload.expressionActivity, 0);
assert.equal(noFace.payload.stability, 0);
assert.equal(noFace.faceCenter, undefined);

console.log("Teacher vision contract passed.");

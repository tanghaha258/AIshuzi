import type {
  TeacherObservationHeadDirection,
  TeacherObservationPayload
} from "../../shared/types";

interface VisionPoint {
  x: number;
  y: number;
}

interface VisionCategory {
  categoryName: string;
  score: number;
}

export interface TeacherVisionResult {
  faceLandmarks?: VisionPoint[][];
  faceBlendshapes?: Array<{ categories: VisionCategory[] }>;
}

export interface FaceCenter {
  x: number;
  y: number;
}

interface DerivedObservation {
  payload: TeacherObservationPayload;
  faceCenter?: FaceCenter;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function findHeadDirection(landmarks: VisionPoint[]): TeacherObservationHeadDirection {
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  if (!nose || !leftEye || !rightEye) return "unknown";

  const eyeSpan = Math.abs(rightEye.x - leftEye.x);
  if (eyeSpan <= 0.01) return "unknown";
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const horizontalOffset = (nose.x - eyeMidX) / eyeSpan;
  const verticalOffset = (nose.y - eyeMidY) / eyeSpan;

  if (horizontalOffset > 0.22) return "right";
  if (horizontalOffset < -0.22) return "left";
  if (verticalOffset < 0.32) return "up";
  if (verticalOffset > 0.82) return "down";
  return "front";
}

function findExpressionActivity(categories: VisionCategory[] = []) {
  const tracked = /smile|jawOpen|browInnerUp|eyeWide|mouthPucker/i;
  const strongest = categories
    .filter((category) => tracked.test(category.categoryName))
    .reduce((score, category) => Math.max(score, category.score), 0);
  return Math.round(clamp(strongest, 0, 1) * 100);
}

function findCenter(landmarks: VisionPoint[]): FaceCenter {
  const sum = landmarks.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return {
    x: rounded(sum.x / landmarks.length, 2),
    y: rounded(sum.y / landmarks.length, 2)
  };
}

function findStability(current: FaceCenter, previous?: FaceCenter) {
  if (!previous) return 72;
  const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
  return Math.round((1 - clamp(distance / 0.12, 0, 1)) * 100);
}

export function deriveTeacherObservation(
  result: TeacherVisionResult,
  capturedAt: string,
  previousCenter?: FaceCenter
): DerivedObservation {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks?.length) {
    return {
      payload: {
        source: "mediapipe",
        faceVisible: false,
        faceConfidence: 0,
        headDirection: "unknown",
        expressionActivity: 0,
        stability: 0,
        capturedAt
      }
    };
  }

  const faceCenter = findCenter(landmarks);
  return {
    payload: {
      source: "mediapipe",
      faceVisible: true,
      faceConfidence: 96,
      headDirection: findHeadDirection(landmarks),
      expressionActivity: findExpressionActivity(result.faceBlendshapes?.[0]?.categories),
      stability: findStability(faceCenter, previousCenter),
      capturedAt
    },
    faceCenter
  };
}

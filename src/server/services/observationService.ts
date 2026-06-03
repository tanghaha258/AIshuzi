import type {
  ClassroomEvent,
  TeacherObservationHeadDirection,
  TeacherObservationPayload,
  TeacherObservationSource
} from "../../shared/types.js";

export type ClassroomEventDraft = Omit<ClassroomEvent, "id" | "timestamp">;

export interface TeacherObservationOptions {
  now?: () => Date;
}

export interface TeacherObservationDrafts {
  observation: TeacherObservationPayload;
  observationEvent: ClassroomEventDraft;
  suggestionEvent?: ClassroomEventDraft;
}

const observationSources: TeacherObservationSource[] = ["mediapipe", "fallback"];
const headDirections: TeacherObservationHeadDirection[] = ["front", "left", "right", "up", "down", "unknown"];
const requiredObservationFields = [
  "source",
  "faceVisible",
  "faceConfidence",
  "headDirection",
  "expressionActivity",
  "stability",
  "capturedAt"
] as const;
const allowedObservationFields = new Set<string>(requiredObservationFields);
const mediaFieldNames = new Set([
  "blob",
  "canvas",
  "frame",
  "frames",
  "image",
  "imagedata",
  "imageurl",
  "snapshot",
  "video",
  "videodata",
  "videoframe",
  "videourl"
]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asObservationRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("教师观察 payload 必须是对象。");
  }
  return input as Record<string, unknown>;
}

function normalizeScore(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} 必须是有效数字。`);
  }
  return Math.round(clamp(value, 0, 100));
}

function normalizeBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} 必须是布尔值。`);
  }
  return value;
}

function normalizeSource(value: unknown): TeacherObservationSource {
  if (typeof value !== "string" || !observationSources.includes(value as TeacherObservationSource)) {
    throw new Error("source 必须是 mediapipe 或 fallback。");
  }
  return value as TeacherObservationSource;
}

function normalizeHeadDirection(value: unknown): TeacherObservationHeadDirection {
  if (typeof value !== "string" || !headDirections.includes(value as TeacherObservationHeadDirection)) {
    throw new Error("headDirection 枚举值无效。");
  }
  return value as TeacherObservationHeadDirection;
}

function normalizeCapturedAt(value: unknown, now: Date) {
  if (typeof value !== "string") {
    throw new Error("capturedAt 必须是有效时间字符串。");
  }
  const candidate = new Date(value);
  if (!Number.isFinite(candidate.getTime())) {
    throw new Error("capturedAt 必须是有效时间字符串。");
  }
  if (candidate.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new Error("capturedAt 不能晚于当前时间 5 分钟以上。");
  }
  return candidate.toISOString();
}

function isMediaValue(value: unknown) {
  return typeof value === "string" && /^data:(image|video)\//i.test(value.trim());
}

function assertObservationSchema(input: Record<string, unknown>) {
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();
    if (!allowedObservationFields.has(key)) {
      if (mediaFieldNames.has(normalizedKey) || isMediaValue(value)) {
        throw new Error("教师观察接口不接收图片或视频数据。");
      }
      throw new Error(`不支持的观察字段：${key}。`);
    }
  }

  const missingFields = requiredObservationFields.filter((field) => !Object.hasOwn(input, field));
  if (missingFields.length) {
    throw new Error(`缺少观察字段：${missingFields.join(", ")}。`);
  }
}

function formatHeadDirection(direction: TeacherObservationHeadDirection) {
  const labels: Record<TeacherObservationHeadDirection, string> = {
    front: "正向",
    left: "偏左",
    right: "偏右",
    up: "偏上",
    down: "偏下",
    unknown: "未知"
  };
  return labels[direction];
}

function activityLabel(value: number) {
  if (value >= 70) return "表情变化活跃";
  if (value >= 30) return "表情变化适中";
  return "表情变化偏少";
}

function stabilityLabel(value: number) {
  if (value >= 70) return "画面稳定";
  if (value >= 35) return "画面基本稳定";
  return "画面不够稳定";
}

interface TeacherObservationAdvice {
  label: string;
  priority: number;
  action: string;
}

function classifyTeacherObservationAdvice(observation: TeacherObservationPayload): TeacherObservationAdvice | undefined {
  if (!observation.faceVisible || observation.faceConfidence < 35) {
    return {
      label: "observation-reliability",
      priority: 1,
      action: "先回到镜头中央并补足光线，后续观察建议才会更可靠。"
    };
  }
  if (observation.headDirection === "down") {
    return {
      label: "look-up-before-question",
      priority: 2,
      action: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。"
    };
  }
  if (observation.headDirection === "left" || observation.headDirection === "right" || observation.headDirection === "up") {
    return {
      label: "return-attention-to-students",
      priority: 3,
      action: "讲解时把视线转回学生区，减少长时间偏离镜头。"
    };
  }
  if (observation.stability < 35) {
    return {
      label: "stabilize-before-continuing",
      priority: 4,
      action: "先固定站位或设备，再继续讲解，避免观察数据失真。"
    };
  }
  if (observation.faceConfidence >= 35 && observation.expressionActivity < 25) {
    return {
      label: "emphasize-key-concept",
      priority: 5,
      action: "讲到关键概念时加入一次停顿、重音或手势强调。"
    };
  }
  return undefined;
}

function buildObservationContent(observation: TeacherObservationPayload) {
  const face = observation.faceVisible
    ? `面部可见，置信度 ${observation.faceConfidence}`
    : `未检测到稳定面部，置信度 ${observation.faceConfidence}`;
  return [
    `教师观察：${face}`,
    `头部方向${formatHeadDirection(observation.headDirection)}`,
    activityLabel(observation.expressionActivity),
    stabilityLabel(observation.stability)
  ].join("；") + "。";
}

function buildSuggestionContent(advice: TeacherObservationAdvice) {
  return `建议：${advice.action}`;
}

export function normalizeTeacherObservation(
  input: unknown,
  options: TeacherObservationOptions = {}
): TeacherObservationPayload {
  const record = asObservationRecord(input);
  assertObservationSchema(record);
  const now = options.now?.() ?? new Date();

  return {
    source: normalizeSource(record.source),
    faceVisible: normalizeBoolean(record.faceVisible, "faceVisible"),
    faceConfidence: normalizeScore(record.faceConfidence, "faceConfidence"),
    headDirection: normalizeHeadDirection(record.headDirection),
    expressionActivity: normalizeScore(record.expressionActivity, "expressionActivity"),
    stability: normalizeScore(record.stability, "stability"),
    capturedAt: normalizeCapturedAt(record.capturedAt, now)
  };
}

export function buildTeacherObservationEvents(
  sessionId: string,
  input: unknown,
  options: TeacherObservationOptions = {}
): TeacherObservationDrafts {
  const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!normalizedSessionId) {
    throw new Error("teacher observation sessionId is required.");
  }

  const observation = normalizeTeacherObservation(input, options);
  const observationEvent: ClassroomEventDraft = {
    sessionId: normalizedSessionId,
    type: "teacher_observation",
    actor: "教师观察",
    content: buildObservationContent(observation),
    metadata: {
      observation,
      localOnly: true
    }
  };
  const advice = classifyTeacherObservationAdvice(observation);
  const suggestionContent = advice ? buildSuggestionContent(advice) : "";
  const suggestionEvent: ClassroomEventDraft | undefined = suggestionContent
    ? {
      sessionId: normalizedSessionId,
      type: "system_suggestion",
      actor: "系统建议",
      content: suggestionContent,
      metadata: {
        source: "teacher_observation",
        adviceLabel: advice?.label,
        advicePriority: advice?.priority,
        observation
      }
    }
    : undefined;

  return {
    observation,
    observationEvent,
    suggestionEvent
  };
}

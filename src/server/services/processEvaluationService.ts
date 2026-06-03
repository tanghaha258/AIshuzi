import type {
  ClassroomEvent,
  LessonPlan,
  ProcessEvidenceType,
  RecordProcessEvidencePayload,
  StudentAgent,
  TrainingSession
} from "../../shared/types.js";

const allowedEvidenceTypes: ProcessEvidenceType[] = [
  "学生复述",
  "追问回应",
  "学生自评",
  "同伴互评",
  "教师观察"
];

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function normalizeProcessEvidenceType(value: unknown): ProcessEvidenceType {
  const normalized = cleanText(value);
  return allowedEvidenceTypes.includes(normalized as ProcessEvidenceType)
    ? normalized as ProcessEvidenceType
    : "教师观察";
}

export function buildProcessEvaluationEvent(
  session: TrainingSession,
  payload: Partial<RecordProcessEvidencePayload>,
  students: StudentAgent[],
  lessonPlan?: LessonPlan
): Omit<ClassroomEvent, "id" | "timestamp"> {
  const evidenceType = normalizeProcessEvidenceType(payload.evidenceType);
  const note = cleanText(payload.note);
  if (!note) {
    throw new Error("过程评价证据内容不能为空。");
  }

  const targetStudentId = cleanText(payload.targetStudentId);
  const targetStudent = targetStudentId
    ? students.find((student) => student.id === targetStudentId)
    : undefined;
  if (targetStudentId && !targetStudent) {
    throw new Error("未找到要记录的学生。");
  }

  const targetLabel = targetStudent?.name ?? "全班";
  const processFocus = lessonPlan?.processEvaluation?.focus || "课堂过程性评价证据";
  const peerReviewPrompt = lessonPlan?.processEvaluation?.peerReviewPrompt || "";

  return {
    sessionId: session.id,
    type: "process_evaluation",
    actor: "过程评价",
    content: `${evidenceType} / ${targetLabel}：${note}`,
    metadata: {
      evidenceType,
      targetStudentId: targetStudent?.id ?? "",
      targetStudentName: targetLabel,
      processFocus,
      peerReviewPrompt,
      lessonPlanId: lessonPlan?.id ?? "",
      source: "teacher-manual"
    }
  };
}

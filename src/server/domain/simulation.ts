import type {
  ClassroomEvent,
  ClassroomMetrics,
  EvaluationReport,
  StudentAgent,
  StudentRuntimeState,
  TrainingSession
} from "../../shared/types.js";
import type { AiSuggestionResult } from "../ai/provider.js";

export function calculateMetrics(events: ClassroomEvent[], students: StudentAgent[]): ClassroomMetrics {
  const teacherEvents = events.filter((event) => event.type === "teacher_utterance").length;
  const studentEvents = events.filter((event) => event.type === "student_response" || event.type === "student_question").length;
  const suggestionEvents = events.filter((event) => event.type === "system_suggestion").length;
  const confusionSignals = events.filter((event) => /不懂|跟不上|困惑|不会|确认|走神/.test(event.content)).length;
  const baseAttention = students.length
    ? students.reduce((sum, student) => sum + student.attention, 0) / students.length
    : 70;
  const baseComprehension = students.length
    ? students.reduce((sum, student) => sum + student.comprehension, 0) / students.length
    : 68;
  const baseParticipation = students.length
    ? students.reduce((sum, student) => sum + student.participation, 0) / students.length
    : 65;

  const interaction = clamp(42 + studentEvents * 8 + teacherEvents * 2, 35, 96);
  const confusion = clamp(18 + confusionSignals * 9 - suggestionEvents * 3, 8, 78);
  const attention = clamp(baseAttention + interaction * 0.12 - confusion * 0.2, 25, 95);
  const clarity = clamp(baseComprehension + teacherEvents * 2 - confusion * 0.25, 25, 95);
  const questioning = clamp(38 + events.filter((event) => event.type === "student_question").length * 15, 20, 95);
  const pace = clamp(76 - Math.max(0, teacherEvents - studentEvents) * 4 + suggestionEvents * 2, 35, 92);
  const engagement = clamp(baseParticipation + studentEvents * 5 - confusion * 0.1, 28, 96);

  return {
    attention: Math.round(attention),
    confusion: Math.round(confusion),
    interaction: Math.round(interaction),
    pace: Math.round(pace),
    clarity: Math.round(clarity),
    questioning: Math.round(questioning),
    engagement: Math.round(engagement)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildTurnEvents(
  sessionId: string,
  aiResult: AiSuggestionResult,
  usedModel: boolean,
  runtimeStates: StudentRuntimeState[] = [],
  fallbackReason = ""
): Array<Omit<ClassroomEvent, "id" | "timestamp">> {
  const runtimeByStudent = new Map(runtimeStates.map((state) => [state.studentId, state]));
  const events: Array<Omit<ClassroomEvent, "id" | "timestamp">> = aiResult.messages.map((message) => ({
    sessionId,
    type: /吗|为什么|怎么|如何|\?|？/.test(message.content) ? "student_question" : "student_response",
    actor: message.studentName,
    content: message.content,
    metadata: {
      studentId: message.studentId,
      mood: message.mood,
      runtimeState: runtimeByStudent.get(message.studentId),
      source: usedModel ? "model" : "local-simulation",
      fallbackReason
    }
  }));

  events.push({
    sessionId,
    type: "system_suggestion",
    actor: "教学策略助手",
    content: aiResult.suggestion,
    metadata: {
      source: usedModel ? "model" : "local-simulation",
      fallbackReason
    }
  });

  return events;
}

export function createReport(
  session: TrainingSession,
  events: ClassroomEvent[],
  students: StudentAgent[]
): EvaluationReport {
  const metrics = calculateMetrics(events, students);
  const teacherEvents = events.filter((event) => event.type === "teacher_utterance");
  const studentQuestions = events.filter((event) => event.type === "student_question");
  const suggestions = events.filter((event) => event.type === "system_suggestion");
  const confusedMoments = events.filter((event) => /不懂|跟不上|困惑|不会|确认|走神/.test(event.content));

  const strengths = [
    metrics.interaction >= 70 ? "能持续触发学生回应，课堂互动密度较好。" : "已经建立基本问答链路，具备继续提升互动密度的基础。",
    metrics.pace >= 70 ? "讲解节奏整体平稳，适合微格试讲训练。" : "能够及时收到系统节奏反馈，为调整教学推进提供依据。",
    studentQuestions.length > 0 ? "学生提出了有效问题，说明课堂具备真实探究感。" : "课堂过程较可控，适合继续增加开放性提问。"
  ];

  const improvements = [
    metrics.confusion > 45
      ? "困惑信号偏高，建议在关键概念处增加例题拆解和即时检测。"
      : "可继续保持概念解释的清晰度，并加入更有挑战性的追问。",
    metrics.engagement < 65
      ? "部分学生参与度不足，建议点名低参与学生复述步骤或完成小任务。"
      : "参与状态较好，可进一步让不同画像学生形成互评互补。",
    suggestions.length > 2
      ? "系统提示较多，说明课堂变化丰富，建议课后复盘每条提示对应的教师回应。"
      : "建议在试讲中主动创造一个突发问题，训练临场安抚和引导能力。"
  ];

  const keyMoments = [
    ...teacherEvents.slice(0, 2).map((event) => `教师发起：${event.content.slice(0, 48)}`),
    ...studentQuestions.slice(0, 2).map((event) => `${event.actor}提问：${event.content.slice(0, 48)}`),
    ...confusedMoments.slice(0, 2).map((event) => `困惑信号：${event.actor} - ${event.content.slice(0, 42)}`)
  ].slice(0, 5);

  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    summary: `本次“${session.courseTitle}”微格试讲共记录 ${events.length} 条课堂事件，互动指数 ${metrics.interaction}，注意力 ${metrics.attention}，困惑度 ${metrics.confusion}。整体适合作为新教师课堂应变训练样本。`,
    metrics,
    strengths,
    improvements,
    keyMoments: keyMoments.length ? keyMoments : ["本次试讲事件较少，建议延长试讲并增加师生互动。"],
    generatedAt: new Date().toISOString()
  };
}

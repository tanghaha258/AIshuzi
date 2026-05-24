import type {
  ClassroomEvent,
  ClassroomMetrics,
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

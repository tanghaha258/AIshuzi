import type {
  ClassroomEvent,
  ClassroomMetrics,
  Course,
  DashboardData,
  EvaluationReport,
  GenerateLessonPlanPayload,
  LessonPlan,
  ModelCallLog,
  ModelProviderConfig,
  ReportEvidenceContext,
  StudentAgent,
  StudentRuntimeState,
  TeacherObservationPayload,
  TrainingTarget,
  TranscriptTurnPayload,
  TrainingSession
} from "../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `请求失败：${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  createCourse: (course: Omit<Course, "id" | "createdAt">) =>
    request<Course>("/api/courses", { method: "POST", body: JSON.stringify(course) }),
  deleteCourse: (courseId: string) =>
    request<{ ok: boolean }>(`/api/courses/${courseId}`, { method: "DELETE" }),
  generateLessonPlan: (payload: GenerateLessonPlanPayload) =>
    request<{
      course: Course;
      lessonPlan: LessonPlan;
      recommendedStudents: StudentAgent[];
      usedModel: boolean;
      fallbackReason: string;
    }>("/api/lesson-plans/generate", { method: "POST", body: JSON.stringify(payload) }),
  getLessonPlan: (courseId: string) =>
    request<LessonPlan>(`/api/courses/${courseId}/lesson-plan`),
  upsertStudent: (student: Partial<StudentAgent>) =>
    request<StudentAgent>("/api/students", { method: "POST", body: JSON.stringify(student) }),
  createSession: (courseId: string, selectedStudentIds: string[]) =>
    request<TrainingSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ courseId, selectedStudentIds })
    }),
  deleteSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/api/sessions/${sessionId}`, { method: "DELETE" }),
  deleteReport: (reportId: string) =>
    request<{ ok: boolean }>(`/api/reports/${reportId}`, { method: "DELETE" }),
  getReportEvidenceContext: (reportId: string, evidenceId: string, radius = 2) =>
    request<ReportEvidenceContext>(`/api/reports/${reportId}/evidence/${encodeURIComponent(evidenceId)}/context?radius=${radius}`),
  createTrainingTarget: (reportId: string, recommendationTitle: string) =>
    request<{ session: TrainingSession; target: TrainingTarget }>(`/api/reports/${reportId}/training-targets`, {
      method: "POST",
      body: JSON.stringify({ recommendationTitle })
    }),
  getSession: (sessionId: string) =>
    request<{ session: TrainingSession; events: ClassroomEvent[]; runtimeStates: StudentRuntimeState[]; report?: EvaluationReport; trainingTarget?: TrainingTarget }>(`/api/sessions/${sessionId}`),
  startSession: (sessionId: string) =>
    request<TrainingSession>(`/api/sessions/${sessionId}/start`, { method: "POST" }),
  sendTurn: (sessionId: string, teacherText: string, inputMode: "manual" | "speech") =>
    request<{
      teacherEvent: ClassroomEvent;
      responses: ClassroomEvent[];
      stateEvents: ClassroomEvent[];
      metricEvent: ClassroomEvent;
      metrics: ClassroomMetrics;
      runtimeStates: StudentRuntimeState[];
      usedModel: boolean;
      fallbackReason: string;
    }>(`/api/sessions/${sessionId}/turn`, {
      method: "POST",
      body: JSON.stringify({ teacherText, inputMode })
    }),
  saveTranscriptSegments: (sessionId: string, payload: TranscriptTurnPayload) =>
    request<{
      transcriptEvents: ClassroomEvent[];
      turnResult?: {
        teacherEvent: ClassroomEvent;
        responses: ClassroomEvent[];
        stateEvents: ClassroomEvent[];
        metricEvent: ClassroomEvent;
        metrics: ClassroomMetrics;
        runtimeStates: StudentRuntimeState[];
        usedModel: boolean;
        fallbackReason: string;
      };
    }>(`/api/sessions/${sessionId}/transcripts`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  saveTeacherObservation: (sessionId: string, payload: TeacherObservationPayload) =>
    request<{
      observationEvent: ClassroomEvent;
      suggestionEvent?: ClassroomEvent;
    }>(`/api/sessions/${sessionId}/observations`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  tickSession: (sessionId: string) =>
    request<{
      stateEvents: ClassroomEvent[];
      runtimeStates: StudentRuntimeState[];
    }>(`/api/sessions/${sessionId}/tick`, { method: "POST" }),
  completeSession: (sessionId: string) =>
    request<{ session: TrainingSession; report: EvaluationReport; trainingTarget?: TrainingTarget }>(`/api/sessions/${sessionId}/complete`, { method: "POST" }),
  getModelProvider: () => request<ModelProviderConfig>("/api/model-provider"),
  listModelCalls: (limit = 50) => request<ModelCallLog[]>(`/api/model-calls?limit=${limit}`),
  saveModelProvider: (payload: Partial<ModelProviderConfig>) =>
    request<ModelProviderConfig>("/api/model-provider", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  testModelProvider: (payload: Partial<ModelProviderConfig>) =>
    request<{ ok: boolean; message: string }>("/api/model-provider/test", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  testModelScenario: (payload: Partial<ModelProviderConfig>, scenario: "student-turn" | "lesson-plan" | "report") =>
    request<{ ok: boolean; message: string; sample?: Record<string, unknown> }>("/api/model-provider/scenario-test", {
      method: "POST",
      body: JSON.stringify({ ...payload, scenario })
    })
};

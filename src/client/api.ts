import type {
  ClassroomEvent,
  ClassroomMetrics,
  Course,
  DashboardData,
  EvaluationReport,
  ModelProviderConfig,
  StudentAgent,
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
  upsertStudent: (student: Partial<StudentAgent>) =>
    request<StudentAgent>("/api/students", { method: "POST", body: JSON.stringify(student) }),
  createSession: (courseId: string, selectedStudentIds: string[]) =>
    request<TrainingSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ courseId, selectedStudentIds })
    }),
  getSession: (sessionId: string) =>
    request<{ session: TrainingSession; events: ClassroomEvent[]; report?: EvaluationReport }>(`/api/sessions/${sessionId}`),
  startSession: (sessionId: string) =>
    request<TrainingSession>(`/api/sessions/${sessionId}/start`, { method: "POST" }),
  sendTurn: (sessionId: string, teacherText: string, inputMode: "manual" | "speech") =>
    request<{
      teacherEvent: ClassroomEvent;
      responses: ClassroomEvent[];
      metricEvent: ClassroomEvent;
      metrics: ClassroomMetrics;
      usedModel: boolean;
    }>(`/api/sessions/${sessionId}/turn`, {
      method: "POST",
      body: JSON.stringify({ teacherText, inputMode })
    }),
  completeSession: (sessionId: string) =>
    request<{ session: TrainingSession; report: EvaluationReport }>(`/api/sessions/${sessionId}/complete`, { method: "POST" }),
  getModelProvider: () => request<ModelProviderConfig>("/api/model-provider"),
  saveModelProvider: (payload: Partial<ModelProviderConfig>) =>
    request<ModelProviderConfig>("/api/model-provider", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  testModelProvider: (payload: Partial<ModelProviderConfig>) =>
    request<{ ok: boolean; message: string }>("/api/model-provider/test", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

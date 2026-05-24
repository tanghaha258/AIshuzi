export type SessionStatus = "draft" | "active" | "completed";

export type EventType =
  | "teacher_utterance"
  | "transcript_segment"
  | "student_response"
  | "student_question"
  | "student_distraction"
  | "student_state_change"
  | "teacher_observation"
  | "system_suggestion"
  | "classroom_metric"
  | "report_evidence";

export interface ModelProviderConfig {
  id: string;
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
  updatedAt: string;
}

export interface StudentAgent {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  foundation: number;
  attention: number;
  comprehension: number;
  participation: number;
  behaviorStyle: string;
  status: string;
  strategy: string;
  createdAt: string;
}

export type StudentRuntimePose =
  | "listening"
  | "smiling"
  | "thinking"
  | "confused"
  | "distracted"
  | "challenging";

export interface StudentRuntimeState {
  sessionId: string;
  studentId: string;
  attention: number;
  comprehension: number;
  participation: number;
  emotion: string;
  pose: StudentRuntimePose;
  statusText: string;
  memory: string[];
  lastSpokeAt?: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  grade: string;
  objectives: string;
  topic: string;
  durationMinutes: number;
  createdAt: string;
}

export type LessonPlanStageType = "导入" | "讲解" | "提问" | "练习" | "总结";

export type PlannedIncidentType = "听不懂" | "抢答" | "质疑" | "沉默" | "跑题";

export type PlanningMode = "free-topic" | "textbook";

export interface LessonPlanStage {
  id: string;
  type: LessonPlanStageType;
  name: string;
  minutes: number;
  teachingMethod: string;
  teacherAction: string;
  actionScript: string;
  expectedStudentResponse: string;
  strategyTip: string;
}

export interface PlannedClassroomIncident {
  id: string;
  type: PlannedIncidentType;
  trigger: string;
  studentRole: string;
  teacherStrategy: string;
}

export interface LessonPlan {
  id: string;
  courseId: string;
  title: string;
  overview: string;
  objectives: string[];
  stages: LessonPlanStage[];
  incidents: PlannedClassroomIncident[];
  recommendedStudentIds: string[];
  generatedBy: "model" | "local";
  planningMode: PlanningMode;
  textbookVersion?: string;
  volume?: string;
  unit?: string;
  lesson?: string;
  period?: string;
  createdAt: string;
  updatedAt: string;
}

export type LessonPlanDraft = Omit<LessonPlan, "id" | "courseId" | "createdAt" | "updatedAt">;

export type ModelCallScenario = "student-turn" | "lesson-plan" | "report" | "provider-test";

export type ModelCallStatus = "success" | "fallback" | "error";

export interface ModelCallLog {
  id: string;
  scenario: ModelCallScenario;
  provider: string;
  model: string;
  baseURL: string;
  status: ModelCallStatus;
  usedModel: boolean;
  fallbackReason: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TrainingSession {
  id: string;
  courseId: string;
  courseTitle: string;
  topic: string;
  status: SessionStatus;
  selectedStudentIds: string[];
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface ClassroomEvent {
  id: string;
  sessionId: string;
  type: EventType;
  actor: string;
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ClassroomMetrics {
  attention: number;
  confusion: number;
  interaction: number;
  pace: number;
  clarity: number;
  questioning: number;
  engagement: number;
}

export interface EvaluationReport {
  id: string;
  sessionId: string;
  summary: string;
  metrics: ClassroomMetrics;
  strengths: string[];
  improvements: string[];
  keyMoments: string[];
  generatedAt: string;
}

export interface DashboardData {
  courses: Course[];
  students: StudentAgent[];
  sessions: TrainingSession[];
  reports: EvaluationReport[];
  lessonPlans: LessonPlan[];
}

export interface SimulationTurn {
  teacherText: string;
  responses: ClassroomEvent[];
  suggestion: ClassroomEvent;
  metrics: ClassroomMetrics;
}

export interface CreateSessionPayload {
  courseId: string;
  selectedStudentIds: string[];
}

export interface CreateCoursePayload {
  title: string;
  subject: string;
  grade: string;
  objectives: string;
  topic: string;
  durationMinutes: number;
}

export interface GenerateLessonPlanPayload {
  title?: string;
  planningMode?: PlanningMode;
  textbookVersion?: string;
  volume?: string;
  unit?: string;
  lesson?: string;
  period?: string;
  subject: string;
  grade: string;
  topic: string;
  objectives: string;
  durationMinutes: number;
}

export interface UpsertModelProviderPayload {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

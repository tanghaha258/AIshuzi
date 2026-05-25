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

export interface ProcessEvaluationDesign {
  focus: string;
  method: string;
  peerReviewPrompt: string;
  evidenceTypes: string[];
}

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
  processEvaluationPoint: string;
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
  processEvaluation?: ProcessEvaluationDesign;
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

export type TrainingTargetStatus = "active" | "completed";

export interface TrainingTarget {
  id: string;
  reportId: string;
  sessionId: string;
  sourceSessionId: string;
  courseId: string;
  recommendationTitle: string;
  recommendationDetail: string;
  action: string;
  evidenceEventIds: string[];
  status: TrainingTargetStatus;
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

export type TranscriptSource = "web-speech" | "manual" | "local-asr";

export interface TranscriptSegment {
  id?: string;
  sessionId: string;
  text: string;
  isFinal: boolean;
  source: TranscriptSource;
  confidence: number;
  startOffsetMs: number;
  endOffsetMs: number;
  language: string;
  createdAt?: string;
}

export interface TranscriptTurnPayload {
  segments: TranscriptSegment[];
  sendAsTurn?: boolean;
}

export type TeacherObservationSource = "mediapipe" | "fallback";

export type TeacherObservationHeadDirection =
  | "front"
  | "left"
  | "right"
  | "up"
  | "down"
  | "unknown";

export interface TeacherObservationPayload {
  source: TeacherObservationSource;
  faceVisible: boolean;
  /** 0-100 */
  faceConfidence: number;
  headDirection: TeacherObservationHeadDirection;
  /** 0-100 */
  expressionActivity: number;
  /** 0-100 */
  stability: number;
  capturedAt: string;
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
  overview: ReportOverview;
  evidence: ReportEvidenceNode[];
  keyTimeline: ReportTimelineItem[];
  studentResponses: StudentResponseSummary[];
  teacherStrategyHits: TeacherStrategyHit[];
  recommendations: EvidenceBoundRecommendation[];
  processEvaluation?: ReportProcessEvaluation;
  exportMarkdown: string;
  exportHtml: string;
  generatedBy: "model" | "local";
  fallbackReason?: string;
  generatedAt: string;
}

export interface ReportOverview {
  totalEvents: number;
  teacherTurns: number;
  studentResponses: number;
  studentQuestions: number;
  systemSuggestions: number;
  teacherObservations: number;
  durationMinutes: number;
}

export interface ReportEvidenceNode {
  id: string;
  eventId: string;
  timestamp: string;
  eventType: EventType;
  actor: string;
  quote: string;
  reason: string;
  weight: number;
}

export interface ReportEvidenceContext {
  reportId: string;
  sessionId: string;
  evidence: ReportEvidenceNode;
  target: ClassroomEvent;
  before: ClassroomEvent[];
  after: ClassroomEvent[];
  events: ClassroomEvent[];
}

export interface ReportTimelineItem {
  time: string;
  title: string;
  description: string;
  evidenceEventId: string;
  eventType: EventType;
}

export interface StudentResponseSummary {
  studentId?: string;
  studentName: string;
  profile: string;
  responseCount: number;
  questionCount: number;
  confusionSignals: number;
  engagementSignals: number;
  evidenceEventIds: string[];
  diagnosis: string;
}

export interface TeacherStrategyHit {
  strategy: string;
  matched: boolean;
  evidenceEventIds: string[];
  diagnosis: string;
}

export interface EvidenceBoundRecommendation {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  action: string;
  evidenceEventIds: string[];
}

export interface ReportProcessEvaluation extends ProcessEvaluationDesign {
  stagePoints: string[];
  evidenceEventIds: string[];
  summary: string;
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
  processEvaluation?: ProcessEvaluationDesign;
}

export interface UpsertModelProviderPayload {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  ClassroomEvent,
  Course,
  EvidenceBoundRecommendation,
  EvaluationReport,
  LessonPlan,
  LessonPlanStage,
  ModelCallLog,
  ModelProviderConfig,
  ProcessEvaluationDesign,
  ReportEvidenceContext,
  StudentAgent,
  StudentRuntimeState,
  TrainingTarget,
  TrainingTargetTemplate,
  TrainingTargetTemplateType,
  TrainingSession
} from "../shared/types.js";
import { createDeepSeekDefaultProvider, isLegacyOpenAiDefaultProvider } from "../shared/providerDefaults.js";
import { runMigrations } from "./db/migrations.js";
import { createInitialRuntimeState } from "./services/studentState.js";

const dataDir = path.resolve(process.cwd(), "data");
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(dataDir, "platform.db");
mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

function now() {
  return new Date().toISOString();
}

function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const trainingTargetTemplateTypes: TrainingTargetTemplateType[] = [
  "concept-check",
  "strategy-follow-up",
  "participation-recovery",
  "camera-presence"
];

function isTrainingTargetTemplateType(value: unknown): value is TrainingTargetTemplateType {
  return typeof value === "string" && trainingTargetTemplateTypes.includes(value as TrainingTargetTemplateType);
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items : fallback;
}

function fallbackTrainingTargetTemplate(recommendationTitle: string, recommendationDetail: string, action: string): TrainingTargetTemplate {
  return {
    type: "concept-check",
    title: "复训：关键概念小步确认",
    scenario: `围绕“${recommendationTitle || "课后建议"}”进行一次短轮复训。${recommendationDetail || ""}`,
    steps: [
      action || "讲完一个关键步骤后停顿 3 秒，请一名学生复述设量和等量关系。",
      "把学生复述中缺失的词补成一句完整判断，再进入下一步。",
      "用一个封闭式小问题确认全班是否跟上。"
    ],
    successCriteria: [
      "学生能复述设量、等量关系和理由，教师再进入下一步。",
      "教师至少完成一次确认性追问。",
      "复训结束时保留一条可回看的学生证据。"
    ],
    evidencePrompts: [
      "记录一条学生复述证据，说明他是否说清关键步骤。",
      "记录一次教师追问后的学生回应变化。"
    ],
    focusMetrics: ["clarity", "questioning", "confusion"]
  };
}

function normalizeTrainingTargetTemplate(value: string | null | undefined, fallback: TrainingTargetTemplate): TrainingTargetTemplate {
  const parsed = json<Partial<TrainingTargetTemplate>>(value, {});
  return {
    type: isTrainingTargetTemplateType(parsed.type) ? parsed.type : fallback.type,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : fallback.title,
    scenario: typeof parsed.scenario === "string" && parsed.scenario.trim() ? parsed.scenario : fallback.scenario,
    steps: stringList(parsed.steps, fallback.steps),
    successCriteria: stringList(parsed.successCriteria, fallback.successCriteria),
    evidencePrompts: stringList(parsed.evidencePrompts, fallback.evidencePrompts),
    focusMetrics: stringList(parsed.focusMetrics, fallback.focusMetrics)
  };
}

function recommendationHasTeacherObservationEvidence(report: EvaluationReport, recommendation: EvidenceBoundRecommendation) {
  const eventTypesById = new Map(report.evidence.map((node) => [node.eventId, node.eventType]));
  return recommendation.evidenceEventIds.some((eventId) => eventTypesById.get(eventId) === "teacher_observation");
}

function classifyTrainingTargetTemplate(report: EvaluationReport, recommendation: EvidenceBoundRecommendation): TrainingTargetTemplateType {
  const text = `${recommendation.title} ${recommendation.detail} ${recommendation.action}`;
  if (/镜头|摄像头|抬头|视线|站位|正对|教师观察/.test(text) || recommendationHasTeacherObservationEvidence(report, recommendation)) {
    return "camera-presence";
  }
  if (/低参与|参与|点名|补充理由|薄弱|内向/.test(text)) {
    return "participation-recovery";
  }
  if (/即时建议|策略|观察点|采纳|系统调控/.test(text)) {
    return "strategy-follow-up";
  }
  return "concept-check";
}

function createTrainingTargetTemplate(report: EvaluationReport, recommendation: EvidenceBoundRecommendation): TrainingTargetTemplate {
  const type = classifyTrainingTargetTemplate(report, recommendation);
  switch (type) {
    case "camera-presence":
      return {
        type,
        title: "复训：教师镜头交流动作",
        scenario: `围绕“${recommendation.title}”进行一次镜头观察复训，把摄像头指标转成面向学生的课堂动作。`,
        steps: [
          "开始提问前先固定站位，抬头看向学生区，再说出问题。",
          "学生回应前保持正对镜头和学生区视线，等待 3 秒后点名。",
          "请一名学生复述关键步骤，再根据回应补充或追问。"
        ],
        successCriteria: [
          "教师提问时保持正对学生区，视线不长时间离开镜头。",
          "镜头观察摘要中的正对镜头率和稳定度不再成为主要问题。",
          "至少出现一次学生复述关键步骤的证据。"
        ],
        evidencePrompts: [
          "记录一次提问前教师是否抬头看向学生区。",
          "记录学生复述后教师是否进行了补充或追问。"
        ],
        focusMetrics: [
          "teacherObservation.frontFacingRate",
          "teacherObservation.averageStability",
          "questioning"
        ]
      };
    case "participation-recovery":
      return {
        type,
        title: "复训：低参与学生可完成任务",
        scenario: `围绕“${recommendation.title}”进行一次参与度复训，把发言任务切成学生能完成的小步。`,
        steps: [
          "先点名低参与学生回答一个只需一步判断的问题。",
          "请积极学生补充理由，但不替代低参与学生的原始表达。",
          "把两名学生的答案合成一句完整结论，再回到全班。"
        ],
        successCriteria: [
          "低参与学生至少完成一次短回应。",
          "教师给出等待时间后再请同伴补充。",
          "学生回应后形成一条可进入报告的过程证据。"
        ],
        evidencePrompts: [
          "记录低参与学生完成了哪一个小步。",
          "记录同伴补充是否帮助原学生修正理解。"
        ],
        focusMetrics: ["engagement", "interaction", "attention"]
      };
    case "strategy-follow-up":
      return {
        type,
        title: "复训：即时策略采纳追踪",
        scenario: `围绕“${recommendation.title}”进行一次策略采纳复训，把系统建议转成可观察动作。`,
        steps: [
          "选择一条即时建议，先说出将要采纳的教师动作。",
          "执行动作后观察学生注意、提问或回应是否变化。",
          "用一句话标记这条策略是否有效，并决定是否继续使用。"
        ],
        successCriteria: [
          "教师至少明确采纳一条即时建议。",
          "采纳后出现学生回应、提问或状态变化证据。",
          "复训报告能追踪策略动作和学生结果之间的关系。"
        ],
        evidencePrompts: [
          "记录教师采纳了哪一条即时建议。",
          "记录采纳后的第一个学生反应。"
        ],
        focusMetrics: ["interaction", "engagement", "systemSuggestions"]
      };
    default:
      return {
        type,
        title: "复训：关键概念小步确认",
        scenario: `围绕“${recommendation.title}”进行一次关键概念复训，把讲解拆成可验证的小步。`,
        steps: [
          "讲完一个关键步骤后停顿 3 秒，请一名学生复述设量和等量关系。",
          "针对学生复述中缺失的部分，用一句追问补齐理由。",
          "再请另一名学生用生活例子确认同一个关系。"
        ],
        successCriteria: [
          "学生能复述关键步骤，并说清设量和等量关系。",
          "教师至少完成一次确认性追问后再进入下一步。",
          "困惑学生能用生活例子重新解释核心概念。"
        ],
        evidencePrompts: [
          "记录一条学生复述证据，说明他是否说清关键步骤。",
          "记录一次追问后的学生修正或补充。"
        ],
        focusMetrics: ["clarity", "questioning", "confusion"]
      };
  }
}

function rowToCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    title: String(row.title),
    subject: String(row.subject),
    grade: String(row.grade),
    objectives: String(row.objectives),
    topic: String(row.topic),
    durationMinutes: Number(row.duration_minutes),
    createdAt: String(row.created_at)
  };
}

function rowToStudent(row: Record<string, unknown>): StudentAgent {
  return {
    id: String(row.id),
    name: String(row.name),
    avatar: String(row.avatar),
    personality: String(row.personality),
    foundation: Number(row.foundation),
    attention: Number(row.attention),
    comprehension: Number(row.comprehension),
    participation: Number(row.participation),
    behaviorStyle: String(row.behavior_style),
    status: String(row.status),
    strategy: String(row.strategy),
    createdAt: String(row.created_at)
  };
}

function rowToSession(row: Record<string, unknown>): TrainingSession {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    courseTitle: String(row.course_title),
    topic: String(row.topic),
    status: row.status as TrainingSession["status"],
    selectedStudentIds: json<string[]>(String(row.selected_student_ids ?? "[]"), []),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function rowToEvent(row: Record<string, unknown>): ClassroomEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    type: row.type as ClassroomEvent["type"],
    actor: String(row.actor),
    content: String(row.content),
    timestamp: String(row.timestamp),
    metadata: json<Record<string, unknown>>(String(row.metadata ?? "{}"), {})
  };
}

function rowToReport(row: Record<string, unknown>): EvaluationReport {
  const overview = json<EvaluationReport["overview"]>(String(row.overview ?? "{}"), {
    totalEvents: 0,
    teacherTurns: 0,
    studentResponses: 0,
    studentQuestions: 0,
    systemSuggestions: 0,
    teacherObservations: 0,
    durationMinutes: 0
  });
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    summary: String(row.summary),
    metrics: json<EvaluationReport["metrics"]>(String(row.metrics ?? "{}"), {
      attention: 0,
      confusion: 0,
      interaction: 0,
      pace: 0,
      clarity: 0,
      questioning: 0,
      engagement: 0
    }),
    strengths: json<string[]>(String(row.strengths ?? "[]"), []),
    improvements: json<string[]>(String(row.improvements ?? "[]"), []),
    keyMoments: json<string[]>(String(row.key_moments ?? "[]"), []),
    overview,
    evidence: json<EvaluationReport["evidence"]>(String(row.evidence ?? "[]"), []),
    keyTimeline: json<EvaluationReport["keyTimeline"]>(String(row.key_timeline ?? "[]"), []),
    studentResponses: json<EvaluationReport["studentResponses"]>(String(row.student_responses ?? "[]"), []),
    teacherStrategyHits: json<EvaluationReport["teacherStrategyHits"]>(String(row.teacher_strategy_hits ?? "[]"), []),
    recommendations: json<EvaluationReport["recommendations"]>(String(row.recommendations ?? "[]"), []),
    teacherObservation: json<EvaluationReport["teacherObservation"]>(String(row.teacher_observation ?? ""), undefined),
    processEvaluation: json<EvaluationReport["processEvaluation"]>(String(row.process_evaluation ?? ""), undefined),
    exportMarkdown: String(row.export_markdown ?? ""),
    exportHtml: String(row.export_html ?? ""),
    generatedBy: row.generated_by === "model" ? "model" : "local",
    fallbackReason: row.fallback_reason ? String(row.fallback_reason) : undefined,
    generatedAt: String(row.generated_at)
  };
}

const defaultTeachingMethods: Record<LessonPlanStage["type"], string> = {
  导入: "情境导入法",
  讲解: "支架式讲解",
  提问: "问题链教学",
  练习: "即时诊断与变式练习",
  总结: "归纳建构法"
};

const defaultStageEvaluationPoints: Record<LessonPlanStage["type"], string> = {
  导入: "观察学生能否说出情境中的关键条件。",
  讲解: "检查学生能否复述关键步骤和依据。",
  提问: "记录学生追问、补充和同伴回应。",
  练习: "收集学生迁移应用和同伴反馈证据。",
  总结: "用学生自评或出口条确认最终理解。"
};

function normalizeLessonStages(stages: LessonPlan["stages"]): LessonPlan["stages"] {
  return stages.map((stage) => ({
    ...stage,
    teachingMethod: stage.teachingMethod || defaultTeachingMethods[stage.type] || "互动讲解法",
    actionScript: stage.actionScript || stage.teacherAction,
    processEvaluationPoint: stage.processEvaluationPoint || defaultStageEvaluationPoints[stage.type] || "记录学生过程表现和同伴反馈。"
  }));
}

function rowProcessEvaluation(row: Record<string, unknown>): ProcessEvaluationDesign | undefined {
  const parsed = json<ProcessEvaluationDesign | undefined>(String(row.process_evaluation ?? ""), undefined);
  if (!parsed?.focus && !parsed?.method && !parsed?.peerReviewPrompt && !parsed?.evidenceTypes?.length) {
    return undefined;
  }
  return {
    focus: parsed.focus || "学生能否说清关键依据和思考过程",
    method: parsed.method || "教师观察 + 学生自评 + 同伴互评",
    peerReviewPrompt: parsed.peerReviewPrompt || "请同伴指出依据是否清楚，并给出一个改进建议。",
    evidenceTypes: Array.isArray(parsed.evidenceTypes) && parsed.evidenceTypes.length
      ? parsed.evidenceTypes
      : ["学生复述", "追问回应", "同伴反馈"]
  };
}

function rowToLessonPlan(row: Record<string, unknown>): LessonPlan {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    title: String(row.title),
    overview: String(row.overview),
    objectives: json<string[]>(String(row.objectives ?? "[]"), []),
    stages: normalizeLessonStages(json<LessonPlan["stages"]>(String(row.stages ?? "[]"), [])),
    incidents: json<LessonPlan["incidents"]>(String(row.incidents ?? "[]"), []),
    recommendedStudentIds: json<string[]>(String(row.recommended_student_ids ?? "[]"), []),
    processEvaluation: rowProcessEvaluation(row),
    generatedBy: row.generated_by === "model" ? "model" : "local",
    planningMode: row.planning_mode === "textbook" ? "textbook" : "free-topic",
    textbookVersion: row.textbook_version ? String(row.textbook_version) : undefined,
    volume: row.volume ? String(row.volume) : undefined,
    unit: row.unit ? String(row.unit) : undefined,
    lesson: row.lesson ? String(row.lesson) : undefined,
    period: row.period ? String(row.period) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToRuntimeState(row: Record<string, unknown>): StudentRuntimeState {
  return {
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    attention: Number(row.attention),
    comprehension: Number(row.comprehension),
    participation: Number(row.participation),
    emotion: String(row.emotion),
    pose: row.pose as StudentRuntimeState["pose"],
    statusText: String(row.status_text),
    memory: json<string[]>(String(row.memory ?? "[]"), []),
    lastSpokeAt: row.last_spoke_at ? String(row.last_spoke_at) : undefined,
    updatedAt: String(row.updated_at)
  };
}

function rowToTrainingTarget(row: Record<string, unknown>): TrainingTarget {
  const recommendationTitle = String(row.recommendation_title);
  const recommendationDetail = String(row.recommendation_detail);
  const action = String(row.action);
  return {
    id: String(row.id),
    reportId: String(row.report_id),
    sessionId: String(row.session_id),
    sourceSessionId: String(row.source_session_id),
    courseId: String(row.course_id),
    recommendationTitle,
    recommendationDetail,
    action,
    evidenceEventIds: json<string[]>(String(row.evidence_event_ids ?? "[]"), []),
    template: normalizeTrainingTargetTemplate(
      row.template ? String(row.template) : undefined,
      fallbackTrainingTargetTemplate(recommendationTitle, recommendationDetail, action)
    ),
    status: row.status === "completed" ? "completed" : "active",
    createdAt: String(row.created_at)
  };
}

function rowToProvider(row: Record<string, unknown>): ModelProviderConfig {
  return {
    id: String(row.id),
    provider: String(row.provider),
    baseURL: String(row.base_url),
    apiKey: String(row.api_key),
    model: String(row.model),
    temperature: Number(row.temperature),
    enabled: Boolean(row.enabled),
    updatedAt: String(row.updated_at)
  };
}

function rowToModelCallLog(row: Record<string, unknown>): ModelCallLog {
  return {
    id: String(row.id),
    scenario: row.scenario as ModelCallLog["scenario"],
    provider: String(row.provider),
    model: String(row.model),
    baseURL: String(row.base_url),
    status: row.status as ModelCallLog["status"],
    usedModel: Boolean(row.used_model),
    fallbackReason: String(row.fallback_reason ?? ""),
    durationMs: Number(row.duration_ms ?? 0),
    metadata: json<Record<string, unknown>>(String(row.metadata ?? "{}"), {}),
    createdAt: String(row.created_at)
  };
}

export function initDb() {
  runMigrations(db);
  seedDefaults();
  pruneOrphanRuntimeStates();
}

function seedDefaults() {
  const courseCount = db.prepare("SELECT COUNT(*) AS total FROM courses").get() as { total: number };
  if (courseCount.total === 0) {
    const courses = [
      {
        title: "勾股定理及其应用",
        subject: "数学",
        grade: "八年级",
        topic: "勾股定理的生活化理解",
        objectives: "学生能够通过直角三角形情境理解 a²+b²=c²，并用定理解决简单实际问题。",
        durationMinutes: 12
      },
      {
        title: "说明文语言的准确性",
        subject: "语文",
        grade: "七年级",
        topic: "抓住限定词体会表达效果",
        objectives: "学生能够识别说明文中的限定词，并解释其对表达准确性的作用。",
        durationMinutes: 10
      }
    ];
    const insertCourse = db.prepare(`
      INSERT INTO courses (id, title, subject, grade, objectives, topic, duration_minutes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const course of courses) {
      insertCourse.run(
        randomUUID(),
        course.title,
        course.subject,
        course.grade,
        course.objectives,
        course.topic,
        course.durationMinutes,
        now()
      );
    }
  }

  const studentCount = db.prepare("SELECT COUNT(*) AS total FROM students").get() as { total: number };
  if (studentCount.total === 0) {
    const students = [
      {
        name: "小明",
        avatar: "走神型",
        personality: "注意力容易漂移，但被点名后能跟上基础问题。",
        foundation: 56,
        attention: 42,
        comprehension: 48,
        participation: 35,
        behaviorStyle: "容易低头走神，需要明确任务牵引。",
        status: "走神",
        strategy: "用短问题拉回注意力，给他可完成的小任务。"
      },
      {
        name: "雨晴",
        avatar: "积极型",
        personality: "愿意举手表达，能带动课堂氛围。",
        foundation: 78,
        attention: 82,
        comprehension: 74,
        participation: 86,
        behaviorStyle: "主动回应，偶尔抢答。",
        status: "投入",
        strategy: "让她先说思路，再请其他学生补充。"
      },
      {
        name: "阿哲",
        avatar: "薄弱型",
        personality: "基础概念不稳，遇到抽象符号容易卡住。",
        foundation: 38,
        attention: 66,
        comprehension: 35,
        participation: 52,
        behaviorStyle: "听不懂时沉默，需要具体例子。",
        status: "困惑",
        strategy: "回到生活化例子，拆分步骤确认理解。"
      },
      {
        name: "思源",
        avatar: "挑战型",
        personality: "思维活跃，喜欢提出边界问题。",
        foundation: 88,
        attention: 76,
        comprehension: 84,
        participation: 73,
        behaviorStyle: "会故意追问例外情况。",
        status: "质疑",
        strategy: "肯定问题价值，并把追问转化为全班探究。"
      },
      {
        name: "可欣",
        avatar: "内向型",
        personality: "理解慢热，书面表达好但口头参与少。",
        foundation: 68,
        attention: 72,
        comprehension: 64,
        participation: 31,
        behaviorStyle: "不主动举手，需要安全感。",
        status: "观望",
        strategy: "先给思考时间，再邀请她读出记录。"
      },
      {
        name: "浩然",
        avatar: "粗心型",
        personality: "会计算但容易跳步，答案偶有低级错误。",
        foundation: 72,
        attention: 58,
        comprehension: 67,
        participation: 62,
        behaviorStyle: "快答快错，需要过程检查。",
        status: "急躁",
        strategy: "要求他说出依据，并展示中间步骤。"
      }
    ];
    const insertStudent = db.prepare(`
      INSERT INTO students (
        id, name, avatar, personality, foundation, attention, comprehension, participation,
        behavior_style, status, strategy, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const student of students) {
      insertStudent.run(
        randomUUID(),
        student.name,
        student.avatar,
        student.personality,
        student.foundation,
        student.attention,
        student.comprehension,
        student.participation,
        student.behaviorStyle,
        student.status,
        student.strategy,
        now()
      );
    }
  }

  const providerCount = db.prepare("SELECT COUNT(*) AS total FROM model_providers").get() as { total: number };
  if (providerCount.total === 0) {
    const provider = createDeepSeekDefaultProvider();
    db.prepare(`
      INSERT INTO model_providers (id, provider, base_url, api_key, model, temperature, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), provider.provider, provider.baseURL, provider.apiKey, provider.model, provider.temperature, provider.enabled ? 1 : 0, now());
    return;
  }

  const currentProviderRow = db.prepare("SELECT * FROM model_providers ORDER BY updated_at DESC LIMIT 1").get() as Record<string, unknown>;
  const currentProvider = rowToProvider(currentProviderRow);
  if (isLegacyOpenAiDefaultProvider(currentProvider)) {
    const provider = createDeepSeekDefaultProvider();
    db.prepare(`
      UPDATE model_providers
      SET provider = ?, base_url = ?, model = ?, temperature = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(provider.provider, provider.baseURL, provider.model, provider.temperature, 0, now(), currentProvider.id);
  }
}

function pruneOrphanRuntimeStates() {
  db.prepare(`
    DELETE FROM student_runtime_states
    WHERE session_id NOT IN (SELECT id FROM sessions)
  `).run();
}

export const store = {
  listCourses(): Course[] {
    return (db.prepare("SELECT * FROM courses ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(rowToCourse);
  },
  createCourse(input: Omit<Course, "id" | "createdAt">): Course {
    const course: Course = { ...input, id: randomUUID(), createdAt: now() };
    db.prepare(`
      INSERT INTO courses (id, title, subject, grade, objectives, topic, duration_minutes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      course.id,
      course.title,
      course.subject,
      course.grade,
      course.objectives,
      course.topic,
      course.durationMinutes,
      course.createdAt
    );
    return course;
  },
  deleteCourse(id: string): boolean {
    db.prepare("DELETE FROM lesson_plans WHERE course_id = ?").run(id);
    const result = db.prepare("DELETE FROM courses WHERE id = ?").run(id);
    return result.changes > 0;
  },
  listStudents(): StudentAgent[] {
    return (db.prepare("SELECT * FROM students ORDER BY created_at ASC").all() as Record<string, unknown>[]).map(rowToStudent);
  },
  upsertStudent(input: Omit<StudentAgent, "id" | "createdAt"> & { id?: string }): StudentAgent {
    const student: StudentAgent = { ...input, id: input.id ?? randomUUID(), createdAt: now() };
    db.prepare(`
      INSERT INTO students (
        id, name, avatar, personality, foundation, attention, comprehension, participation,
        behavior_style, status, strategy, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        avatar = excluded.avatar,
        personality = excluded.personality,
        foundation = excluded.foundation,
        attention = excluded.attention,
        comprehension = excluded.comprehension,
        participation = excluded.participation,
        behavior_style = excluded.behavior_style,
        status = excluded.status,
        strategy = excluded.strategy
    `).run(
      student.id,
      student.name,
      student.avatar,
      student.personality,
      student.foundation,
      student.attention,
      student.comprehension,
      student.participation,
      student.behaviorStyle,
      student.status,
      student.strategy,
      student.createdAt
    );
    return student;
  },
  listSessions(): TrainingSession[] {
    return (db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(rowToSession);
  },
  getSession(id: string): TrainingSession | undefined {
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToSession(row) : undefined;
  },
  createSession(course: Course, selectedStudentIds: string[]): TrainingSession {
    const session: TrainingSession = {
      id: randomUUID(),
      courseId: course.id,
      courseTitle: course.title,
      topic: course.topic,
      status: "draft",
      selectedStudentIds,
      createdAt: now()
    };
    db.prepare(`
      INSERT INTO sessions (id, course_id, course_title, topic, status, selected_student_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.courseId,
      session.courseTitle,
      session.topic,
      session.status,
      JSON.stringify(session.selectedStudentIds),
      session.createdAt
    );
    return session;
  },
  deleteSession(id: string): boolean {
    db.prepare("DELETE FROM training_targets WHERE session_id = ? OR source_session_id = ?").run(id, id);
    db.prepare("DELETE FROM student_runtime_states WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM events WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM reports WHERE session_id = ?").run(id);
    const result = db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return result.changes > 0;
  },
  updateSessionStatus(id: string, status: TrainingSession["status"]): TrainingSession | undefined {
    const timestampField = status === "active" ? "started_at" : status === "completed" ? "ended_at" : "created_at";
    db.prepare(`UPDATE sessions SET status = ?, ${timestampField} = COALESCE(${timestampField}, ?) WHERE id = ?`).run(status, now(), id);
    if (status === "completed") {
      db.prepare("UPDATE training_targets SET status = 'completed' WHERE session_id = ?").run(id);
    }
    return this.getSession(id);
  },
  addEvent(event: Omit<ClassroomEvent, "id" | "timestamp"> & { id?: string; timestamp?: string }): ClassroomEvent {
    const record: ClassroomEvent = {
      ...event,
      id: event.id ?? randomUUID(),
      timestamp: event.timestamp ?? now()
    };
    db.prepare(`
      INSERT INTO events (id, session_id, type, actor, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sessionId,
      record.type,
      record.actor,
      record.content,
      record.timestamp,
      JSON.stringify(record.metadata ?? {})
    );
    return record;
  },
  listEvents(sessionId: string): ClassroomEvent[] {
    return (db.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC").all(sessionId) as Record<string, unknown>[]).map(rowToEvent);
  },
  listRuntimeStates(sessionId: string): StudentRuntimeState[] {
    return (
      db.prepare("SELECT * FROM student_runtime_states WHERE session_id = ? ORDER BY student_id ASC").all(sessionId) as Record<string, unknown>[]
    ).map(rowToRuntimeState);
  },
  ensureRuntimeStates(sessionId: string, students: StudentAgent[]): StudentRuntimeState[] {
    const existing = this.listRuntimeStates(sessionId);
    const existingIds = new Set(existing.map((state) => state.studentId));
    const created = students
      .filter((student) => !existingIds.has(student.id))
      .map((student) => this.upsertRuntimeState(createInitialRuntimeState(sessionId, student)));
    return [...existing, ...created].filter((state) => students.some((student) => student.id === state.studentId));
  },
  upsertRuntimeState(state: StudentRuntimeState): StudentRuntimeState {
    db.prepare(`
      INSERT INTO student_runtime_states (
        session_id, student_id, attention, comprehension, participation, emotion,
        pose, status_text, memory, last_spoke_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        attention = excluded.attention,
        comprehension = excluded.comprehension,
        participation = excluded.participation,
        emotion = excluded.emotion,
        pose = excluded.pose,
        status_text = excluded.status_text,
        memory = excluded.memory,
        last_spoke_at = excluded.last_spoke_at,
        updated_at = excluded.updated_at
    `).run(
      state.sessionId,
      state.studentId,
      state.attention,
      state.comprehension,
      state.participation,
      state.emotion,
      state.pose,
      state.statusText,
      JSON.stringify(state.memory),
      state.lastSpokeAt ?? null,
      state.updatedAt
    );
    return state;
  },
  listAllEvents(): ClassroomEvent[] {
    return (db.prepare("SELECT * FROM events ORDER BY timestamp ASC").all() as Record<string, unknown>[]).map(rowToEvent);
  },
  listReports(): EvaluationReport[] {
    return (db.prepare("SELECT * FROM reports ORDER BY generated_at DESC").all() as Record<string, unknown>[]).map(rowToReport);
  },
  getReportById(id: string): EvaluationReport | undefined {
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToReport(row) : undefined;
  },
  getReportEvidenceContext(reportId: string, evidenceId: string, radius = 2): ReportEvidenceContext | undefined {
    const report = this.getReportById(reportId);
    if (!report) return undefined;
    const evidence = report.evidence.find((node) => node.id === evidenceId || node.eventId === evidenceId);
    if (!evidence) return undefined;

    const events = this
      .listEvents(report.sessionId)
      .filter((event) => event.type !== "report_evidence");
    const targetIndex = events.findIndex((event) => event.id === evidence.eventId);
    if (targetIndex < 0) return undefined;

    const safeRadius = Number.isFinite(radius) ? Math.max(0, Math.min(8, Math.round(radius))) : 2;
    const before = events.slice(Math.max(0, targetIndex - safeRadius), targetIndex);
    const target = events[targetIndex];
    const after = events.slice(targetIndex + 1, targetIndex + 1 + safeRadius);

    return {
      reportId: report.id,
      sessionId: report.sessionId,
      evidence,
      target,
      before,
      after,
      events: [...before, target, ...after]
    };
  },
  getTrainingTargetBySession(sessionId: string): TrainingTarget | undefined {
    const row = db.prepare("SELECT * FROM training_targets WHERE session_id = ?").get(sessionId) as Record<string, unknown> | undefined;
    return row ? rowToTrainingTarget(row) : undefined;
  },
  createTrainingTargetFromRecommendation(reportId: string, recommendationTitle: string): { session: TrainingSession; target: TrainingTarget } | undefined {
    const report = this.getReportById(reportId);
    if (!report) return undefined;
    const recommendation = report.recommendations.find((item) => item.title === recommendationTitle) ?? report.recommendations[0];
    if (!recommendation) return undefined;
    const sourceSession = this.getSession(report.sessionId);
    if (!sourceSession) return undefined;
    const course = this.listCourses().find((item) => item.id === sourceSession.courseId) ?? {
      id: sourceSession.courseId,
      title: sourceSession.courseTitle,
      subject: "历史实训",
      grade: "未设置",
      objectives: report.summary,
      topic: sourceSession.topic,
      durationMinutes: Math.max(8, report.overview.durationMinutes || 10),
      createdAt: sourceSession.createdAt
    };

    const session = this.createSession(course, sourceSession.selectedStudentIds);
    const template = createTrainingTargetTemplate(report, recommendation);
    const target: TrainingTarget = {
      id: randomUUID(),
      reportId: report.id,
      sessionId: session.id,
      sourceSessionId: sourceSession.id,
      courseId: course.id,
      recommendationTitle: recommendation.title,
      recommendationDetail: recommendation.detail,
      action: recommendation.action,
      evidenceEventIds: recommendation.evidenceEventIds,
      template,
      status: "active",
      createdAt: now()
    };
    db.prepare(`
      INSERT INTO training_targets (
        id, report_id, session_id, source_session_id, course_id,
        recommendation_title, recommendation_detail, action, evidence_event_ids,
        template, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      target.id,
      target.reportId,
      target.sessionId,
      target.sourceSessionId,
      target.courseId,
      target.recommendationTitle,
      target.recommendationDetail,
      target.action,
      JSON.stringify(target.evidenceEventIds),
      JSON.stringify(target.template),
      target.status,
      target.createdAt
    );
    return { session, target };
  },
  deleteReport(id: string): boolean {
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return false;
    const sessionId = String(row.session_id);
    db.prepare("DELETE FROM training_targets WHERE report_id = ?").run(id);
    db.prepare("DELETE FROM events WHERE session_id = ? AND type = 'report_evidence'").run(sessionId);
    const result = db.prepare("DELETE FROM reports WHERE id = ?").run(id);
    return result.changes > 0;
  },
  listLessonPlans(): LessonPlan[] {
    return (db.prepare("SELECT * FROM lesson_plans ORDER BY updated_at DESC").all() as Record<string, unknown>[]).map(rowToLessonPlan);
  },
  getLessonPlan(courseId: string): LessonPlan | undefined {
    const row = db.prepare("SELECT * FROM lesson_plans WHERE course_id = ?").get(courseId) as Record<string, unknown> | undefined;
    return row ? rowToLessonPlan(row) : undefined;
  },
  saveLessonPlan(input: Omit<LessonPlan, "id" | "createdAt" | "updatedAt"> & { id?: string }): LessonPlan {
    const existing = this.getLessonPlan(input.courseId);
    const timestamp = now();
    const lessonPlan: LessonPlan = {
      ...input,
      id: input.id ?? existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO lesson_plans (
        id, course_id, title, overview, objectives, stages, incidents,
        recommended_student_ids, process_evaluation, generated_by, planning_mode, textbook_version, volume,
        unit, lesson, period, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(course_id) DO UPDATE SET
        title = excluded.title,
        overview = excluded.overview,
        objectives = excluded.objectives,
        stages = excluded.stages,
        incidents = excluded.incidents,
        recommended_student_ids = excluded.recommended_student_ids,
        process_evaluation = excluded.process_evaluation,
        generated_by = excluded.generated_by,
        planning_mode = excluded.planning_mode,
        textbook_version = excluded.textbook_version,
        volume = excluded.volume,
        unit = excluded.unit,
        lesson = excluded.lesson,
        period = excluded.period,
        updated_at = excluded.updated_at
    `).run(
      lessonPlan.id,
      lessonPlan.courseId,
      lessonPlan.title,
      lessonPlan.overview,
      JSON.stringify(lessonPlan.objectives),
      JSON.stringify(lessonPlan.stages),
      JSON.stringify(lessonPlan.incidents),
      JSON.stringify(lessonPlan.recommendedStudentIds),
      JSON.stringify(lessonPlan.processEvaluation ?? null),
      lessonPlan.generatedBy,
      lessonPlan.planningMode,
      lessonPlan.textbookVersion ?? null,
      lessonPlan.volume ?? null,
      lessonPlan.unit ?? null,
      lessonPlan.lesson ?? null,
      lessonPlan.period ?? null,
      lessonPlan.createdAt,
      lessonPlan.updatedAt
    );
    return lessonPlan;
  },
  addModelCallLog(log: Omit<ModelCallLog, "id" | "createdAt"> & { id?: string; createdAt?: string }): ModelCallLog {
    const record: ModelCallLog = {
      ...log,
      id: log.id ?? randomUUID(),
      createdAt: log.createdAt ?? now()
    };
    db.prepare(`
      INSERT INTO model_call_logs (
        id, scenario, provider, model, base_url, status, used_model,
        fallback_reason, duration_ms, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.scenario,
      record.provider,
      record.model,
      record.baseURL,
      record.status,
      record.usedModel ? 1 : 0,
      record.fallbackReason,
      record.durationMs,
      JSON.stringify(record.metadata ?? {}),
      record.createdAt
    );
    return record;
  },
  listModelCallLogs(limit = 50): ModelCallLog[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.round(limit))) : 50;
    return (
      db.prepare("SELECT * FROM model_call_logs ORDER BY created_at DESC LIMIT ?").all(safeLimit) as Record<string, unknown>[]
    ).map(rowToModelCallLog);
  },
  getReport(sessionId: string): EvaluationReport | undefined {
    const row = db.prepare("SELECT * FROM reports WHERE session_id = ?").get(sessionId) as Record<string, unknown> | undefined;
    return row ? rowToReport(row) : undefined;
  },
  saveReport(report: EvaluationReport): EvaluationReport {
    db.prepare("DELETE FROM events WHERE session_id = ? AND type = 'report_evidence'").run(report.sessionId);
    db.prepare(`
      INSERT INTO reports (
        id, session_id, summary, metrics, strengths, improvements, key_moments,
        overview, evidence, key_timeline, student_responses, teacher_strategy_hits,
        recommendations, teacher_observation, process_evaluation, export_markdown, export_html, generated_by, fallback_reason, generated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        id = excluded.id,
        summary = excluded.summary,
        metrics = excluded.metrics,
        strengths = excluded.strengths,
        improvements = excluded.improvements,
        key_moments = excluded.key_moments,
        overview = excluded.overview,
        evidence = excluded.evidence,
        key_timeline = excluded.key_timeline,
        student_responses = excluded.student_responses,
        teacher_strategy_hits = excluded.teacher_strategy_hits,
        recommendations = excluded.recommendations,
        teacher_observation = excluded.teacher_observation,
        process_evaluation = excluded.process_evaluation,
        export_markdown = excluded.export_markdown,
        export_html = excluded.export_html,
        generated_by = excluded.generated_by,
        fallback_reason = excluded.fallback_reason,
        generated_at = excluded.generated_at
    `).run(
      report.id,
      report.sessionId,
      report.summary,
      JSON.stringify(report.metrics),
      JSON.stringify(report.strengths),
      JSON.stringify(report.improvements),
      JSON.stringify(report.keyMoments),
      JSON.stringify(report.overview),
      JSON.stringify(report.evidence),
      JSON.stringify(report.keyTimeline),
      JSON.stringify(report.studentResponses),
      JSON.stringify(report.teacherStrategyHits),
      JSON.stringify(report.recommendations),
      JSON.stringify(report.teacherObservation ?? null),
      JSON.stringify(report.processEvaluation ?? null),
      report.exportMarkdown,
      report.exportHtml,
      report.generatedBy,
      report.fallbackReason ?? "",
      report.generatedAt
    );
    return report;
  },
  getProvider(): ModelProviderConfig {
    const row = db.prepare("SELECT * FROM model_providers ORDER BY updated_at DESC LIMIT 1").get() as Record<string, unknown>;
    return rowToProvider(row);
  },
  saveProvider(input: Omit<ModelProviderConfig, "id" | "updatedAt">): ModelProviderConfig {
    const current = this.getProvider();
    const config: ModelProviderConfig = { ...input, id: current?.id ?? randomUUID(), updatedAt: now() };
    db.prepare(`
      INSERT INTO model_providers (id, provider, base_url, api_key, model, temperature, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        base_url = excluded.base_url,
        api_key = excluded.api_key,
        model = excluded.model,
        temperature = excluded.temperature,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(
      config.id,
      config.provider,
      config.baseURL,
      config.apiKey,
      config.model,
      config.temperature,
      config.enabled ? 1 : 0,
      config.updatedAt
    );
    return config;
  },
  healthCheck() {
    const result = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    return result.ok === 1;
  }
};

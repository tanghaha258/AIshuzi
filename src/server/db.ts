import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  ClassroomEvent,
  Course,
  EvaluationReport,
  LessonPlan,
  ModelProviderConfig,
  StudentAgent,
  StudentRuntimeState,
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
    generatedAt: String(row.generated_at)
  };
}

function rowToLessonPlan(row: Record<string, unknown>): LessonPlan {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    title: String(row.title),
    overview: String(row.overview),
    objectives: json<string[]>(String(row.objectives ?? "[]"), []),
    stages: json<LessonPlan["stages"]>(String(row.stages ?? "[]"), []),
    incidents: json<LessonPlan["incidents"]>(String(row.incidents ?? "[]"), []),
    recommendedStudentIds: json<string[]>(String(row.recommended_student_ids ?? "[]"), []),
    generatedBy: row.generated_by === "model" ? "model" : "local",
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

export function initDb() {
  runMigrations(db);
  seedDefaults();
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
    db.prepare("DELETE FROM events WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM reports WHERE session_id = ?").run(id);
    const result = db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return result.changes > 0;
  },
  updateSessionStatus(id: string, status: TrainingSession["status"]): TrainingSession | undefined {
    const timestampField = status === "active" ? "started_at" : status === "completed" ? "ended_at" : "created_at";
    db.prepare(`UPDATE sessions SET status = ?, ${timestampField} = COALESCE(${timestampField}, ?) WHERE id = ?`).run(status, now(), id);
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
        recommended_student_ids, generated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(course_id) DO UPDATE SET
        title = excluded.title,
        overview = excluded.overview,
        objectives = excluded.objectives,
        stages = excluded.stages,
        incidents = excluded.incidents,
        recommended_student_ids = excluded.recommended_student_ids,
        generated_by = excluded.generated_by,
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
      lessonPlan.generatedBy,
      lessonPlan.createdAt,
      lessonPlan.updatedAt
    );
    return lessonPlan;
  },
  getReport(sessionId: string): EvaluationReport | undefined {
    const row = db.prepare("SELECT * FROM reports WHERE session_id = ?").get(sessionId) as Record<string, unknown> | undefined;
    return row ? rowToReport(row) : undefined;
  },
  saveReport(report: EvaluationReport): EvaluationReport {
    db.prepare(`
      INSERT INTO reports (id, session_id, summary, metrics, strengths, improvements, key_moments, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        summary = excluded.summary,
        metrics = excluded.metrics,
        strengths = excluded.strengths,
        improvements = excluded.improvements,
        key_moments = excluded.key_moments,
        generated_at = excluded.generated_at
    `).run(
      report.id,
      report.sessionId,
      report.summary,
      JSON.stringify(report.metrics),
      JSON.stringify(report.strengths),
      JSON.stringify(report.improvements),
      JSON.stringify(report.keyMoments),
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

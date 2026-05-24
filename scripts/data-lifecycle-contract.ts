import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { findReusableSession, sessionStatusLabel } from "../src/shared/sessionLifecycle.js";
import type { EvaluationReport, TrainingSession } from "../src/shared/types.js";

const lifecycleDb = path.resolve("data/data-lifecycle-contract.db");
mkdirSync(path.dirname(lifecycleDb), { recursive: true });
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${lifecycleDb}${suffix}`;
  if (existsSync(file)) rmSync(file, { force: true });
}
process.env.DATABASE_PATH = "data/data-lifecycle-contract.db";

const { initDb, store } = await import("../src/server/db.js");

function makeReport(id: string, sessionId: string): EvaluationReport {
  return {
    id,
    sessionId,
    summary: "课堂报告摘要",
    metrics: {
      attention: 70,
      confusion: 30,
      interaction: 65,
      pace: 72,
      clarity: 68,
      questioning: 75,
      engagement: 66
    },
    strengths: ["导入贴近生活"],
    improvements: ["补充更明确的追问"],
    keyMoments: ["学生提出关键疑问"],
    overview: {
      totalEvents: 3,
      teacherTurns: 1,
      studentResponses: 1,
      studentQuestions: 1,
      systemSuggestions: 0,
      teacherObservations: 0,
      durationMinutes: 1
    },
    evidence: [],
    keyTimeline: [],
    studentResponses: [],
    teacherStrategyHits: [],
    recommendations: [],
    exportMarkdown: "# 课堂报告",
    exportHtml: "<article>课堂报告</article>",
    generatedBy: "local",
    generatedAt: "2026-05-24T09:00:00.000Z"
  };
}

initDb();

assert.equal(sessionStatusLabel("draft"), "未开始");
assert.equal(sessionStatusLabel("active"), "进行中");
assert.equal(sessionStatusLabel("completed"), "已完成");

const reusableSessions: TrainingSession[] = [
  {
    id: "completed-session",
    courseId: "course-a",
    courseTitle: "一元二次方程",
    topic: "生活化理解",
    status: "completed",
    selectedStudentIds: [],
    createdAt: "2026-05-24T08:00:00.000Z"
  },
  {
    id: "draft-session",
    courseId: "course-a",
    courseTitle: "一元二次方程",
    topic: "生活化理解",
    status: "draft",
    selectedStudentIds: [],
    createdAt: "2026-05-24T08:05:00.000Z"
  },
  {
    id: "active-session",
    courseId: "course-a",
    courseTitle: "一元二次方程",
    topic: "生活化理解",
    status: "active",
    selectedStudentIds: [],
    createdAt: "2026-05-24T08:10:00.000Z"
  }
];

assert.equal(findReusableSession(reusableSessions, "course-a")?.id, "active-session");
assert.equal(findReusableSession(reusableSessions, "missing-course"), undefined);

const students = store.listStudents().slice(0, 2);
const course = store.createCourse({
  title: "数据生命周期测试课",
  subject: "数学",
  grade: "八年级",
  objectives: "验证删除链路",
  topic: "删除实训与报告",
  durationMinutes: 10
});

const session = store.createSession(course, students.map((student) => student.id));
store.ensureRuntimeStates(session.id, students);
assert.ok(store.listRuntimeStates(session.id).length > 0);
store.addEvent({
  sessionId: session.id,
  type: "teacher_utterance",
  actor: "教师",
  content: "同学们，我们先看一个生活问题。",
  metadata: {}
});
store.saveReport(makeReport("report-session-delete", session.id));

assert.equal(store.deleteSession(session.id), true);
assert.equal(store.getSession(session.id), undefined);
assert.equal(store.listEvents(session.id).length, 0);
assert.equal(store.getReport(session.id), undefined);
assert.equal(store.listRuntimeStates(session.id).length, 0);

const reportSession = store.createSession(course, students.map((student) => student.id));
const normalEvent = store.addEvent({
  sessionId: reportSession.id,
  type: "teacher_utterance",
  actor: "教师",
  content: "这条普通课堂事件应在删除报告后保留。",
  metadata: {}
});
store.addEvent({
  sessionId: reportSession.id,
  type: "report_evidence",
  actor: "报告证据",
  content: "这条报告证据应随报告删除。",
  metadata: { reportId: "report-only-delete" }
});
store.saveReport(makeReport("report-only-delete", reportSession.id));

assert.equal(store.deleteReport("report-only-delete"), true);
assert.ok(store.getSession(reportSession.id));
assert.equal(store.getReport(reportSession.id), undefined);
assert.equal(store.listEvents(reportSession.id).some((event) => event.type === "report_evidence"), false);
assert.ok(store.listEvents(reportSession.id).some((event) => event.id === normalEvent.id));

const repeatReportSession = store.createSession(course, students.map((student) => student.id));
store.saveReport(makeReport("report-first", repeatReportSession.id));
store.addEvent({
  sessionId: repeatReportSession.id,
  type: "report_evidence",
  actor: "报告证据",
  content: "第一次报告证据应在重新保存报告时清理。",
  metadata: { reportId: "report-first" }
});
store.saveReport(makeReport("report-second", repeatReportSession.id));
store.addEvent({
  sessionId: repeatReportSession.id,
  type: "report_evidence",
  actor: "报告证据",
  content: "第二次报告证据应随当前报告删除。",
  metadata: { reportId: "report-second" }
});

assert.equal(store.getReport(repeatReportSession.id)?.id, "report-second");
assert.equal(store.listEvents(repeatReportSession.id).filter((event) => event.type === "report_evidence").length, 1);
assert.equal(store.deleteReport("report-second"), true);
assert.equal(store.getReport(repeatReportSession.id), undefined);
assert.equal(store.listEvents(repeatReportSession.id).some((event) => event.type === "report_evidence"), false);

console.log("Data lifecycle contract passed.");

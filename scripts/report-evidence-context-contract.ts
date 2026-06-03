import assert from "node:assert/strict";
import { rmSync } from "node:fs";

process.env.DATABASE_PATH = "data/test-report-evidence-context.db";
rmSync(process.env.DATABASE_PATH, { force: true });

const [{ initDb, store }, { createLocalEvaluationReport, createReportEvidenceEvents }] = await Promise.all([
  import("../src/server/db.js"),
  import("../src/server/services/reportGenerator.js")
]);

initDb();

const course = store.createCourse({
  title: "一元二次方程",
  subject: "数学",
  grade: "八年级",
  objectives: "用生活情境理解一元二次方程的建模过程。",
  topic: "一元二次方程的生活化理解",
  durationMinutes: 10
});

const students = store.listStudents().slice(0, 2);
const session = store.createSession(course, students.map((student) => student.id));
store.updateSessionStatus(session.id, "active");

const teacherEvent = store.addEvent({
  id: "ctx-teacher-1",
  sessionId: session.id,
  type: "teacher_utterance",
  actor: "教师",
  content: "同学们，操场围栏一边靠墙，只围三面时怎样建立面积关系？",
  timestamp: "2026-05-24T09:00:00.000Z",
  metadata: { input: "manual" }
});
const studentEvent = store.addEvent({
  id: "ctx-student-1",
  sessionId: session.id,
  type: "student_question",
  actor: students[0].name,
  content: "老师，我还是不明白为什么长度和宽度都要设成未知数。",
  timestamp: "2026-05-24T09:01:00.000Z",
  metadata: { studentId: students[0].id }
});
const suggestionEvent = store.addEvent({
  id: "ctx-suggestion-1",
  sessionId: session.id,
  type: "system_suggestion",
  actor: "教学策略助手",
  content: "建议暂停推进，先让学生画出三面围栏并标出变量。",
  timestamp: "2026-05-24T09:02:00.000Z",
  metadata: { source: "contract" }
});

const completedSession = store.updateSessionStatus(session.id, "completed") ?? session;
const report = createLocalEvaluationReport({
  session: completedSession,
  events: store.listEvents(session.id),
  students,
  generatedAt: "2026-05-24T09:10:00.000Z"
});

store.saveReport(report);
createReportEvidenceEvents(report).forEach((event) => store.addEvent(event));

const evidence = report.evidence.find((node) => node.eventId === studentEvent.id);
assert.ok(evidence, "student question should become report evidence");

const context = store.getReportEvidenceContext(report.id, evidence.id, 1);
assert.ok(context, "report evidence context should exist");
assert.equal(context.reportId, report.id);
assert.equal(context.evidence.id, evidence.id);
assert.equal(context.target.id, studentEvent.id);
assert.equal(context.before.at(-1)?.id, teacherEvent.id);
assert.equal(context.after[0]?.id, suggestionEvent.id);
assert.ok(context.events.every((event) => event.type !== "report_evidence"));

const missing = store.getReportEvidenceContext(report.id, "missing-evidence", 1);
assert.equal(missing, undefined);

console.log("Report evidence context contract passed.");

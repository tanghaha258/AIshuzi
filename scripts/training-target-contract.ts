import assert from "node:assert/strict";
import { rmSync } from "node:fs";

process.env.DATABASE_PATH = "data/test-training-target.db";
rmSync(process.env.DATABASE_PATH, { force: true });

const [{ initDb, store }, { createLocalEvaluationReport }] = await Promise.all([
  import("../src/server/db.js"),
  import("../src/server/services/reportGenerator.js")
]);

initDb();

const course = store.createCourse({
  title: "一元二次方程",
  subject: "数学",
  grade: "八年级",
  objectives: "把生活问题抽象成一元二次方程并解释参数意义。",
  topic: "一元二次方程的生活化理解",
  durationMinutes: 10
});
const students = store.listStudents().slice(0, 3);
const session = store.createSession(course, students.map((student) => student.id));
store.updateSessionStatus(session.id, "active");
store.addEvent({
  id: "target-teacher-1",
  sessionId: session.id,
  type: "teacher_utterance",
  actor: "教师",
  content: "如果用 20 米围栏靠墙围一个矩形菜园，面积怎样表示？",
  timestamp: "2026-05-24T10:00:00.000Z",
  metadata: {}
});
store.addEvent({
  id: "target-student-1",
  sessionId: session.id,
  type: "student_question",
  actor: students[0].name,
  content: "老师，我不明白为什么只围三面也能列方程。",
  timestamp: "2026-05-24T10:01:00.000Z",
  metadata: { studentId: students[0].id }
});
const completedSession = store.updateSessionStatus(session.id, "completed") ?? session;
const report = createLocalEvaluationReport({
  session: completedSession,
  events: store.listEvents(session.id),
  students,
  generatedAt: "2026-05-24T10:10:00.000Z"
});
store.saveReport(report);

const recommendation = report.recommendations[0];
assert.ok(recommendation, "report should create at least one recommendation");

const result = store.createTrainingTargetFromRecommendation(report.id, recommendation.title);
assert.ok(result, "recommendation should create a training target and new session");
assert.equal(result.target.reportId, report.id);
assert.equal(result.target.recommendationTitle, recommendation.title);
assert.deepEqual(result.target.evidenceEventIds, recommendation.evidenceEventIds);
assert.equal(result.session.status, "draft");
assert.equal(result.session.courseId, course.id);
assert.notEqual(result.session.id, session.id);

const storedTarget = store.getTrainingTargetBySession(result.session.id);
assert.equal(storedTarget?.id, result.target.id);
assert.equal(storedTarget?.sessionId, result.session.id);
assert.match(storedTarget?.action ?? "", /确认|复述|问题|步骤|观察点/);

store.updateSessionStatus(result.session.id, "active");
store.updateSessionStatus(result.session.id, "completed");
assert.equal(store.getTrainingTargetBySession(result.session.id)?.status, "completed");

store.deleteCourse(course.id);
const historicalTargetResult = store.createTrainingTargetFromRecommendation(report.id, recommendation.title);
assert.ok(historicalTargetResult, "historical reports should still create targets after the course entry is deleted");
assert.equal(historicalTargetResult.session.courseId, course.id);
assert.equal(historicalTargetResult.session.courseTitle, course.title);
assert.equal(historicalTargetResult.target.sourceSessionId, session.id);

console.log("Training target contract passed.");

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
report.recommendations.unshift({
  title: "把关键概念拆成可验证小步",
  detail: "学生已经出现理解阻滞，下一轮每讲一步就让学生用生活例子复述。",
  priority: "high",
  action: "在讲解后追加“先设什么、为什么这样设、等量关系是什么”三连确认。",
  evidenceEventIds: ["target-student-1"]
});
store.saveReport(report);

const recommendation = report.recommendations[0];
assert.ok(recommendation, "report should create at least one recommendation");

const result = store.createTrainingTargetFromRecommendation(report.id, recommendation.title);
assert.ok(result, "recommendation should create a training target and new session");
assert.equal(result.target.reportId, report.id);
assert.equal(result.target.recommendationTitle, recommendation.title);
assert.deepEqual(result.target.evidenceEventIds, recommendation.evidenceEventIds);
assert.equal(result.target.template.type, "concept-check");
assert.match(result.target.template.title, /复训|关键概念|小步/);
assert.match(result.target.template.scenario, new RegExp(recommendation.title));
assert.ok(result.target.template.steps.length >= 3);
assert.ok(result.target.template.successCriteria.length >= 3);
assert.ok(result.target.template.evidencePrompts.length >= 2);
assert.ok(result.target.template.focusMetrics.includes("clarity"));
assert.ok(result.target.template.focusMetrics.includes("questioning"));
assert.match(result.target.template.steps.join(" "), /复述|关键步骤|等量关系/);
assert.match(result.target.template.successCriteria.join(" "), /学生|复述|确认/);
assert.match(result.target.template.evidencePrompts.join(" "), /证据|学生/);
assert.equal(result.session.status, "draft");
assert.equal(result.session.courseId, course.id);
assert.notEqual(result.session.id, session.id);

const storedTarget = store.getTrainingTargetBySession(result.session.id);
assert.equal(storedTarget?.id, result.target.id);
assert.equal(storedTarget?.sessionId, result.session.id);
assert.deepEqual(storedTarget?.template, result.target.template);
assert.match(storedTarget?.action ?? "", /确认|复述|问题|步骤|观察点/);

store.addEvent({
  id: "target-camera-1",
  sessionId: session.id,
  type: "teacher_observation",
  actor: "教师观察",
  content: "教师镜头观察：下一轮提问前先抬头看向学生区。",
  timestamp: "2026-05-24T10:02:00.000Z",
  metadata: {
    source: "teacher_observation",
    adviceLabel: "look-up-before-question",
    observation: {
      source: "mediapipe",
      faceVisible: true,
      faceConfidence: 82,
      headDirection: "down",
      expressionActivity: 30,
      stability: 68,
      capturedAt: "2026-05-24T10:02:00.000Z"
    }
  }
});
const cameraReport = createLocalEvaluationReport({
  session: completedSession,
  events: store.listEvents(session.id),
  students,
  generatedAt: "2026-05-24T10:12:00.000Z"
});
cameraReport.recommendations.unshift({
  title: "优化教师镜头交流",
  detail: "教师镜头观察显示存在低头或视线偏离，下一轮需要把观察数据转成课堂交流动作。",
  priority: "medium",
  action: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。",
  evidenceEventIds: ["target-camera-1"]
});
store.saveReport(cameraReport);
const storedCameraReport = store.getReportById(cameraReport.id);
assert.ok(storedCameraReport?.teacherObservation, "saved camera reports should keep teacher observation summaries");
assert.equal(storedCameraReport.teacherObservation.sampleCount, cameraReport.teacherObservation?.sampleCount);
assert.deepEqual(storedCameraReport.teacherObservation.evidenceEventIds, cameraReport.teacherObservation?.evidenceEventIds);
const cameraTargetResult = store.createTrainingTargetFromRecommendation(cameraReport.id, "优化教师镜头交流");
assert.ok(cameraTargetResult, "camera recommendation should create a retraining target");
assert.equal(cameraTargetResult.target.template.type, "camera-presence");
assert.match(cameraTargetResult.target.template.steps.join(" "), /抬头|学生区|复述|站位/);
assert.match(cameraTargetResult.target.template.successCriteria.join(" "), /正对|视线|镜头/);
assert.ok(cameraTargetResult.target.template.focusMetrics.includes("teacherObservation.frontFacingRate"));

store.updateSessionStatus(result.session.id, "active");
store.updateSessionStatus(result.session.id, "completed");
assert.equal(store.getTrainingTargetBySession(result.session.id)?.status, "completed");

store.deleteCourse(course.id);
const historicalTargetResult = store.createTrainingTargetFromRecommendation(cameraReport.id, "优化教师镜头交流");
assert.ok(historicalTargetResult, "historical reports should still create targets after the course entry is deleted");
assert.equal(historicalTargetResult.session.courseId, course.id);
assert.equal(historicalTargetResult.session.courseTitle, course.title);
assert.equal(historicalTargetResult.target.sourceSessionId, session.id);

console.log("Training target contract passed.");

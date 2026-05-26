import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  buildReportEvidence,
  createLocalEvaluationReport,
  renderReportHtml,
  renderReportMarkdown
} from "../src/server/services/reportGenerator.js";
import type { ClassroomEvent, LessonPlan, ProcessEvaluationDesign, StudentAgent } from "../src/shared/types.js";

const contractDb = path.resolve("data/process-evaluation-contract.db");
mkdirSync(path.dirname(contractDb), { recursive: true });
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${contractDb}${suffix}`;
  if (existsSync(file)) rmSync(file, { force: true });
}
process.env.DATABASE_PATH = "data/process-evaluation-contract.db";

const { initDb, store } = await import("../src/server/db.js");

const processEvaluation: ProcessEvaluationDesign = {
  focus: "学生能否说清设元依据和等量关系",
  method: "教师观察 + 学生自评 + 同伴互评",
  peerReviewPrompt: "请同桌指出对方是否说清了两个未知量分别表示什么，并补充一个理由。",
  evidenceTypes: ["学生复述", "追问回应", "同伴互评", "教师观察"]
};

initDb();

const students = store.listStudents().slice(0, 2);
assert.ok(students.length >= 2);
const targetStudent = students[0] as StudentAgent;

const course = store.createCourse({
  title: "过程评价闭环测试课",
  subject: "数学",
  grade: "八年级",
  objectives: "验证过程性评价证据能进入课后报告。",
  topic: "二元一次方程的生活化理解",
  durationMinutes: 10
});

const lessonPlan = store.saveLessonPlan({
  courseId: course.id,
  title: "过程评价闭环测试脚本",
  overview: "通过生活化问题验证设元和等量关系。",
  objectives: ["学生能复述设元依据", "学生能参与同伴互评"],
  stages: [
    {
      id: "stage-question",
      type: "提问",
      name: "提问：核对设元依据",
      minutes: 2,
      teachingMethod: "问题链教学",
      teacherAction: "请学生复述 x、y 分别表示什么。",
      actionScript: "教师追问：如果 x 表示苹果单价，y 表示梨单价，总价等式应如何写？",
      expectedStudentResponse: "学生能说出 x、y 与总价之间的关系。",
      strategyTip: "让同伴补充遗漏的依据。",
      processEvaluationPoint: "记录学生复述与同伴互评，判断是否说清设元依据。"
    }
  ],
  incidents: [],
  recommendedStudentIds: students.map((student) => student.id),
  processEvaluation,
  generatedBy: "local",
  planningMode: "free-topic"
}) as LessonPlan;

const session = store.createSession(course, students.map((student) => student.id));
store.updateSessionStatus(session.id, "active");

const teacherEvent = store.addEvent({
  sessionId: session.id,
  type: "teacher_utterance",
  actor: "教师",
  content: "请小明复述一下 x 和 y 分别表示什么。",
  metadata: { input: "manual" }
});

const processEvent = store.addEvent({
  sessionId: session.id,
  type: "process_evaluation" as ClassroomEvent["type"],
  actor: "过程评价",
  content: "学生复述：小明能说出 x 表示苹果单价，y 表示梨单价，但还需要同伴补充总价关系。",
  metadata: {
    evidenceType: "学生复述",
    targetStudentId: targetStudent.id,
    targetStudentName: targetStudent.name,
    processFocus: processEvaluation.focus,
    peerReviewPrompt: processEvaluation.peerReviewPrompt,
    source: "teacher-manual"
  }
});

const persistedEvents = store.listEvents(session.id);
const persistedProcessEvent = persistedEvents.find((event) => event.id === processEvent.id);
assert.equal(persistedProcessEvent?.type, "process_evaluation");
assert.equal(persistedProcessEvent?.metadata.evidenceType, "学生复述");
assert.equal(persistedProcessEvent?.metadata.targetStudentId, targetStudent.id);
assert.equal(persistedProcessEvent?.metadata.processFocus, processEvaluation.focus);
assert.equal(persistedProcessEvent?.metadata.source, "teacher-manual");

const evidence = buildReportEvidence(persistedEvents);
const processEvidence = evidence.find((node) => node.eventId === processEvent.id);
assert.ok(processEvidence, "process evaluation event should be promoted into report evidence");
assert.equal(processEvidence?.eventType, "process_evaluation");
assert.ok((processEvidence?.weight ?? 0) > 90);
assert.match(processEvidence?.reason ?? "", /过程性评价|教师记录/);
assert.ok(evidence.findIndex((node) => node.eventId === processEvent.id) < evidence.findIndex((node) => node.eventId === teacherEvent.id));

const completedSession = store.updateSessionStatus(session.id, "completed") ?? session;
const report = createLocalEvaluationReport({
  session: completedSession,
  events: persistedEvents,
  students,
  lessonPlan,
  generatedAt: "2026-05-26T10:00:00.000Z"
});

assert.ok(report.processEvaluation?.evidenceEventIds.includes(processEvent.id));
assert.match(report.processEvaluation?.summary ?? "", /教师记录|过程性评价证据|学生复述/);
assert.ok(report.evidence.some((node) => node.eventId === processEvent.id));

const markdown = renderReportMarkdown(report);
assert.match(markdown, /过程性评价/);
assert.match(markdown, /学生复述/);
assert.match(markdown, new RegExp(processEvent.id));

const html = renderReportHtml(report);
assert.match(html, /过程性评价/);
assert.match(html, /学生复述/);
assert.doesNotMatch(html, /<script/i);

console.log("Process evaluation contract passed.");

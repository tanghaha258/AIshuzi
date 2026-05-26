import assert from "node:assert/strict";
import {
  createLocalEvaluationReport,
  createReportEvidenceEvents,
  renderReportHtml,
  renderReportMarkdown
} from "../src/server/services/reportGenerator.js";
import type { ClassroomEvent, LessonPlan, StudentAgent, TrainingSession } from "../src/shared/types.js";

const session: TrainingSession = {
  id: "session-report",
  courseId: "course-1",
  courseTitle: "二元一次方程",
  topic: "二元一次方程生活化理解",
  status: "completed",
  selectedStudentIds: ["student-1", "student-2"],
  createdAt: "2026-05-24T08:00:00.000Z",
  startedAt: "2026-05-24T08:00:00.000Z",
  endedAt: "2026-05-24T08:10:00.000Z"
};

const students: StudentAgent[] = [
  {
    id: "student-1",
    name: "阿哲",
    avatar: "薄弱型",
    personality: "基础薄弱，容易困惑",
    foundation: 42,
    attention: 58,
    comprehension: 40,
    participation: 45,
    behaviorStyle: "听不懂时沉默，需要具象例子",
    status: "困惑",
    strategy: "回到生活化例子，拆分步骤确认理解。",
    createdAt: "2026-05-24T08:00:00.000Z"
  },
  {
    id: "student-2",
    name: "思源",
    avatar: "挑战型",
    personality: "喜欢追问边界",
    foundation: 82,
    attention: 88,
    comprehension: 84,
    participation: 76,
    behaviorStyle: "会故意追问例外情况",
    status: "质疑",
    strategy: "把问题转化为全班探究。",
    createdAt: "2026-05-24T08:00:00.000Z"
  }
];

const events: ClassroomEvent[] = [
  {
    id: "event-teacher-1",
    sessionId: session.id,
    type: "teacher_utterance",
    actor: "教师",
    content: "同学们，如果买苹果和梨一共花了 18 元，我们可以设几个未知量？",
    timestamp: "2026-05-24T08:01:00.000Z",
    metadata: { input: "manual" }
  },
  {
    id: "event-student-1",
    sessionId: session.id,
    type: "student_question",
    actor: "阿哲",
    content: "老师，我还是不懂，为什么要设两个未知量？",
    timestamp: "2026-05-24T08:02:00.000Z",
    metadata: { studentId: "student-1" }
  },
  {
    id: "event-strategy-1",
    sessionId: session.id,
    type: "system_suggestion",
    actor: "教学策略助手",
    content: "建议暂停推进，用价格标签例子拆分等量关系。",
    timestamp: "2026-05-24T08:02:30.000Z",
    metadata: { source: "local-simulation" }
  },
  {
    id: "event-student-2",
    sessionId: session.id,
    type: "student_question",
    actor: "思源",
    content: "如果苹果价格不是整数，还能这样设吗？",
    timestamp: "2026-05-24T08:03:00.000Z",
    metadata: { studentId: "student-2" }
  },
  {
    id: "event-vision-1",
    sessionId: session.id,
    type: "teacher_observation",
    actor: "教师观察",
    content: "教师观察：面部可见，置信度 82；头部方向正向；表情变化适中；画面稳定。",
    timestamp: "2026-05-24T08:04:00.000Z",
    metadata: { observation: { faceVisible: true, stability: 80 } }
  },
  {
    id: "event-process-1",
    sessionId: session.id,
    type: "process_evaluation",
    actor: "过程评价",
    content: "学生复述 / 阿哲：阿哲能说出 x、y 分别表示苹果和梨的单价，但需要同伴补充总价关系。",
    timestamp: "2026-05-24T08:04:30.000Z",
    metadata: {
      evidenceType: "学生复述",
      targetStudentId: "student-1",
      targetStudentName: "阿哲",
      processFocus: "学生能否说出设元依据和等量关系",
      source: "teacher-manual"
    }
  },
  {
    id: "event-old-report-evidence",
    sessionId: session.id,
    type: "report_evidence",
    actor: "旧报告证据",
    content: "旧报告证据：这条内容不应再次进入新的报告证据链。",
    timestamp: "2026-05-24T08:05:00.000Z",
    metadata: { sourceEventId: "event-teacher-1" }
  }
];

const lessonPlan: LessonPlan = {
  id: "lesson-plan-report",
  courseId: session.courseId,
  title: "二元一次方程生活化微格试讲脚本",
  overview: "围绕二元一次方程生活化理解设计试讲。",
  objectives: ["学生能解释两个未知量和等量关系"],
  stages: [
    {
      id: "stage-intro",
      type: "导入",
      name: "导入：买水果情境",
      minutes: 2,
      teachingMethod: "情境导入法",
      teacherAction: "提出买水果总价问题。",
      actionScript: "老师出示苹果和梨总价问题，引导学生设两个未知量。",
      expectedStudentResponse: "学生尝试说出 x 和 y 的含义。",
      strategyTip: "先收集不同设法。",
      processEvaluationPoint: "观察学生是否能说清 x、y 分别表示什么。"
    }
  ],
  incidents: [],
  recommendedStudentIds: ["student-1", "student-2"],
  generatedBy: "local",
  planningMode: "free-topic",
  processEvaluation: {
    focus: "学生能否说出设元依据和等量关系",
    method: "教师观察 + 学生自评 + 同伴互评",
    peerReviewPrompt: "请同桌指出对方是否说清了依据，并补充一个改进建议。",
    evidenceTypes: ["学生复述", "追问回应", "同伴反馈"]
  },
  createdAt: "2026-05-24T08:00:00.000Z",
  updatedAt: "2026-05-24T08:00:00.000Z"
};

const report = createLocalEvaluationReport({
  session,
  events,
  students,
  lessonPlan,
  generatedAt: "2026-05-24T08:11:00.000Z"
});

assert.equal(report.sessionId, session.id);
assert.equal(report.generatedBy, "local");
assert.ok(report.overview.totalEvents >= events.length);
assert.ok(report.overview.studentQuestions >= 2);
assert.ok(report.evidence.length >= 3);
assert.ok(report.evidence.every((node) => node.eventId && node.quote.length <= 90));
assert.ok(report.evidence.every((node) => node.eventType !== "report_evidence"));
assert.ok(report.evidence.some((node) => node.eventId === "event-process-1" && node.eventType === "process_evaluation"));
assert.ok(report.keyTimeline.some((item) => item.evidenceEventId === "event-student-1"));
assert.ok(report.studentResponses.some((item) => item.studentName === "阿哲" && item.confusionSignals >= 1));
assert.ok(report.teacherStrategyHits.some((item) => item.evidenceEventIds.includes("event-strategy-1")));
assert.ok(report.recommendations.length >= 2);
assert.ok(report.recommendations.every((item) => item.evidenceEventIds.length > 0));
assert.equal(report.processEvaluation?.focus, lessonPlan.processEvaluation?.focus);
assert.match(report.processEvaluation?.summary ?? "", /过程性评价|同伴互评|学生复述|教师记录/);
assert.ok(report.processEvaluation?.stagePoints.some((item) => item.includes("x、y")));
assert.ok(report.processEvaluation?.evidenceEventIds.includes("event-process-1"));

const evidenceEvents = createReportEvidenceEvents(report);
assert.equal(evidenceEvents.length, report.evidence.length);
assert.equal(evidenceEvents[0].type, "report_evidence");
assert.equal(evidenceEvents[0].metadata.reportId, report.id);

const markdown = renderReportMarkdown(report);
assert.match(markdown, /# 二元一次方程/);
assert.match(markdown, /证据/);
assert.match(markdown, /阿哲/);
assert.match(markdown, /过程性评价/);

const html = renderReportHtml(report);
assert.match(html, /<article/);
assert.match(html, /二元一次方程/);
assert.match(html, /过程性评价/);
assert.doesNotMatch(html, /<script/i);

console.log("Report generator contract passed.");

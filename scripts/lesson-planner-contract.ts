import assert from "node:assert/strict";
import {
  buildLocalLessonPlan,
  normalizeLessonPlanResult,
  recommendStudentsForLesson
} from "../src/server/services/lessonPlanner.js";
import type { GenerateLessonPlanPayload, StudentAgent } from "../src/shared/types.js";

const createdAt = "2026-05-24T10:00:00.000Z";

const input: GenerateLessonPlanPayload = {
  subject: "数学",
  grade: "八年级",
  topic: "勾股定理的生活化理解",
  objectives: "学生能够用生活例子解释直角三角形三边关系，并完成一次即时判断。",
  durationMinutes: 10
};

const students: StudentAgent[] = [
  {
    id: "low-attention",
    name: "小明",
    avatar: "走神型",
    personality: "注意力容易漂移，被点名后愿意跟上。",
    foundation: 56,
    attention: 35,
    comprehension: 52,
    participation: 38,
    behaviorStyle: "容易低头走神，需要明确任务牵引。",
    status: "走神",
    strategy: "用短问题拉回注意力。",
    createdAt
  },
  {
    id: "low-comprehension",
    name: "阿哲",
    avatar: "薄弱型",
    personality: "基础概念不稳，遇到抽象符号容易卡住。",
    foundation: 38,
    attention: 66,
    comprehension: 34,
    participation: 50,
    behaviorStyle: "听不懂时沉默，需要具体例子。",
    status: "困惑",
    strategy: "回到生活化例子，拆分步骤确认理解。",
    createdAt
  },
  {
    id: "challenger",
    name: "思源",
    avatar: "挑战型",
    personality: "思维活跃，喜欢提出边界问题。",
    foundation: 88,
    attention: 76,
    comprehension: 84,
    participation: 73,
    behaviorStyle: "会故意追问例外情况。",
    status: "质疑",
    strategy: "肯定问题价值，并转化为全班探究。",
    createdAt
  },
  {
    id: "active",
    name: "雨晴",
    avatar: "积极型",
    personality: "愿意举手表达，能带动课堂氛围。",
    foundation: 78,
    attention: 82,
    comprehension: 74,
    participation: 88,
    behaviorStyle: "主动回应，偶尔抢答。",
    status: "投入",
    strategy: "让她先说思路，再请其他学生补充。",
    createdAt
  },
  {
    id: "introvert",
    name: "可欣",
    avatar: "内向型",
    personality: "理解慢热，书面表达好但口头参与少。",
    foundation: 68,
    attention: 72,
    comprehension: 64,
    participation: 28,
    behaviorStyle: "不主动举手，需要安全感。",
    status: "观望",
    strategy: "先给思考时间，再邀请她读出记录。",
    createdAt
  },
  {
    id: "careless",
    name: "浩然",
    avatar: "粗心型",
    personality: "会计算但容易跳步，答案偶有低级错误。",
    foundation: 72,
    attention: 58,
    comprehension: 67,
    participation: 62,
    behaviorStyle: "快答快错，需要过程检查。",
    status: "急躁",
    strategy: "要求说出依据，并展示中间步骤。",
    createdAt
  }
];

const recommended = recommendStudentsForLesson(students, 6);
assert.equal(recommended.length, 6);
assert.ok(recommended.some((student) => student.id === "low-attention"), "includes low-attention student");
assert.ok(recommended.some((student) => student.id === "low-comprehension"), "includes low-comprehension student");
assert.ok(recommended.some((student) => student.id === "challenger"), "includes challenging student");
assert.ok(recommended.some((student) => student.id === "active"), "includes active student");

const localPlan = buildLocalLessonPlan(input, students);
assert.match(localPlan.title, /勾股定理/);
assert.deepEqual(localPlan.stages.map((stage) => stage.type), ["导入", "讲解", "提问", "练习", "总结"]);
assert.equal(
  localPlan.stages.reduce((sum, stage) => sum + stage.minutes, 0),
  input.durationMinutes
);
assert.ok(localPlan.incidents.length >= 4);
assert.ok(localPlan.recommendedStudentIds.length >= 4);
assert.ok(localPlan.overview.includes("微格"));

const normalized = normalizeLessonPlanResult(
  {
    title: "模型生成的勾股定理微格课",
    objectives: ["会找直角边"],
    stages: [
      { name: "导入", minutes: 50, teacherAction: "出示校园路线问题" },
      { name: "提问", minutes: -2, expectedStudentResponse: "学生说出最长边" }
    ],
    incidents: [
      { type: "跑题", trigger: "学生讨论操场路线", studentRole: "走神型" },
      { type: "未知类型", trigger: "", teacherStrategy: "" }
    ],
    recommendedStudentIds: ["low-attention", "missing-student", "challenger"]
  },
  input,
  students,
  "model"
);

assert.equal(normalized.generatedBy, "model");
assert.equal(normalized.stages.length, 5);
assert.equal(
  normalized.stages.reduce((sum, stage) => sum + stage.minutes, 0),
  input.durationMinutes
);
assert.ok(normalized.incidents.every((incident) => incident.trigger && incident.teacherStrategy));
assert.deepEqual(normalized.recommendedStudentIds, ["low-attention", "challenger"]);

console.log("Lesson planner contract passed.");

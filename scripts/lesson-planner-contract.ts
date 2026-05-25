import assert from "node:assert/strict";
import {
  buildLocalLessonPlan,
  normalizeLessonPlanResult,
  recommendStudentsForLesson
} from "../src/server/services/lessonPlanner.js";
import { buildLessonPlanPrompt } from "../src/server/ai/prompts.js";
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
assert.ok(localPlan.stages.every((stage) => stage.teachingMethod));
assert.ok(localPlan.stages.some((stage) => /情境|导入|支架|问题|诊断|归纳/.test(stage.teachingMethod)));
assert.ok(localPlan.stages.every((stage) => stage.actionScript && stage.actionScript.length > stage.teacherAction.length));
assert.ok(localPlan.stages.some((stage) => /老师|板书|追问|练习|学生/.test(stage.actionScript)));
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
      {
        name: "导入",
        minutes: 50,
        teachingMethod: "情境导入法",
        teacherAction: "出示校园路线问题",
        actionScript: "老师出示：操场长 40 米、宽 30 米，沿对角线走到对面至少要走多少米？请学生先估一估。"
      },
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
assert.ok(normalized.stages.every((stage) => stage.teachingMethod));
assert.equal(normalized.stages[0].teachingMethod, "情境导入法");
assert.ok(normalized.stages.every((stage) => stage.actionScript));
assert.match(normalized.stages[0].actionScript, /操场|40|30/);
assert.equal(
  normalized.stages.reduce((sum, stage) => sum + stage.minutes, 0),
  input.durationMinutes
);
assert.ok(normalized.incidents.every((incident) => incident.trigger && incident.teacherStrategy));
assert.deepEqual(normalized.recommendedStudentIds, ["low-attention", "challenger"]);

const genericAligned = normalizeLessonPlanResult(
  {
    title: "二元一次方程生活化微格试讲脚本",
    overview: "围绕二元一次方程的生活应用，用购物总价情境帮助学生理解两个未知量与方程关系。",
    stages: [
      {
        type: "导入",
        teachingMethod: "情境导入法",
        teacherAction: "提出买水果总价问题，引导学生设苹果和香蕉的数量。",
        actionScript: "老师出示：苹果每斤 5 元、香蕉每斤 3 元，小组一共花 42 元。请学生先说可以设哪些未知量，再板书 5x + 3y = 42。"
      }
    ],
    incidents: [],
    recommendedStudentIds: []
  },
  {
    subject: "数学",
    grade: "八年级",
    topic: "二元一次方程生活化理解",
    objectives: "学生能从生活问题中抽象出二元一次方程，并解释方程中每一项的意义。",
    durationMinutes: 10
  },
  students,
  "model"
);
assert.equal(genericAligned.generatedBy, "model");
assert.match(genericAligned.stages[0].actionScript, /二元一次方程|5x \+ 3y|42/);

const offTopicNormalized = normalizeLessonPlanResult(
  {
    title: "乘法分配律的初步认识",
    overview: "围绕乘法分配律设计微格试讲。",
    stages: [
      {
        type: "导入",
        teachingMethod: "情境导入法",
        teacherAction: "提出买校服问题。",
        actionScript: "老师出示：一件上衣60元，一条裤子40元，买3套，一共多少钱？"
      }
    ],
    incidents: [],
    recommendedStudentIds: []
  },
  {
    subject: "数学",
    grade: "八年级",
    topic: "一元二次方程的生活化",
    objectives: "学生能够从实际问题中抽象出一元二次方程，并解释方程中每一项的意义。",
    durationMinutes: 10
  },
  students,
  "model"
);
assert.equal(offTopicNormalized.generatedBy, "local");
assert.match(offTopicNormalized.title, /一元二次方程/);
assert.match(offTopicNormalized.stages[0].actionScript, /长方形|面积|48|x|方程/);

const textbookPlan = buildLocalLessonPlan(
  {
    ...input,
    planningMode: "textbook",
    textbookVersion: "人教版",
    volume: "八年级下册",
    unit: "第十八章",
    lesson: "勾股定理",
    period: "第1课时"
  },
  students
);
assert.equal(textbookPlan.planningMode, "textbook");
assert.match(textbookPlan.overview, /人教版|第十八章|第1课时/);

const quadraticPlan = buildLocalLessonPlan(
  {
    subject: "数学",
    grade: "八年级",
    topic: "一元二次方程的生活化",
    objectives: "学生能够从实际问题中抽象出一元二次方程，并解释方程中每一项的意义。",
    durationMinutes: 10
  },
  students
);
assert.ok(quadraticPlan.stages.every((stage) => stage.actionScript));
assert.match(quadraticPlan.stages[0].actionScript, /长方形|面积|48|x|方程/);
assert.match(quadraticPlan.stages[1].actionScript, /x|x \+ 4|x²|48|板书/);
assert.doesNotMatch(quadraticPlan.stages[0].teacherAction, /贴近学生生活的问题引出/);

const promptText = buildLessonPlanPrompt(
  {
    ...input,
    topic: "一元二次方程的生活化"
  },
  students
).messages.map((message) => message.content).join("\n");
assert.match(promptText, /actionScript/);
assert.match(promptText, /具体题目|课堂话术|板书|追问/);
assert.match(promptText, /禁止|不要/);
assert.match(promptText, /贴近生活|引导学生|围绕目标/);

console.log("Lesson planner contract passed.");

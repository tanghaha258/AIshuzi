import assert from "node:assert/strict";
import { generateAiStudentTurn } from "../src/server/ai/provider.js";
import { buildStudentTurnPrompt } from "../src/server/ai/prompts.js";
import type {
  ClassroomEvent,
  ModelProviderConfig,
  StudentAgent,
  StudentRuntimeState,
  TrainingSession
} from "../src/shared/types.js";

const now = "2026-05-24T09:00:00.000Z";

const disabledProvider: ModelProviderConfig = {
  id: "provider-test",
  provider: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-chat",
  temperature: 0.4,
  enabled: false,
  updatedAt: now
};

const session: TrainingSession = {
  id: "session-1",
  courseId: "course-1",
  courseTitle: "说明文语言的准确性",
  topic: "抓住限定词体会表达效果",
  status: "active",
  selectedStudentIds: ["student-ming", "student-siyuan"],
  createdAt: now
};

const distractedStudent: StudentAgent = {
  id: "student-ming",
  name: "小明",
  avatar: "走神型",
  personality: "注意力容易漂移，但被点名后愿意回答。",
  foundation: 56,
  attention: 36,
  comprehension: 48,
  participation: 35,
  behaviorStyle: "容易低头走神，需要明确任务牵引。",
  status: "走神",
  strategy: "用短问题拉回注意力。",
  createdAt: now
};

const challengeStudent: StudentAgent = {
  id: "student-siyuan",
  name: "思源",
  avatar: "挑战型",
  personality: "思维活跃，喜欢提出边界问题。",
  foundation: 88,
  attention: 76,
  comprehension: 84,
  participation: 73,
  behaviorStyle: "会故意追问例外情况。",
  status: "质疑",
  strategy: "把追问转化为全班探究。",
  createdAt: now
};

const runtimeStates: StudentRuntimeState[] = [
  {
    sessionId: session.id,
    studentId: distractedStudent.id,
    attention: 39,
    comprehension: 52,
    participation: 41,
    emotion: "回到课堂",
    pose: "distracted",
    statusText: "刚才漏听了第一步",
    memory: ["老师刚才讲了先找关键词，再看限定词是否能删。"],
    updatedAt: now
  },
  {
    sessionId: session.id,
    studentId: challengeStudent.id,
    attention: 78,
    comprehension: 86,
    participation: 79,
    emotion: "准备追问边界",
    pose: "challenging",
    statusText: "准备追问边界",
    memory: ["刚才讨论的是限定词不能随便删除。"],
    updatedAt: now
  }
];

const recentEvents: ClassroomEvent[] = [
  {
    id: "event-1",
    sessionId: session.id,
    type: "teacher_utterance",
    actor: "教师",
    content: "我们先找关键词，再判断限定词能不能删除。",
    timestamp: now,
    metadata: {}
  }
];

const namedTurn = await generateAiStudentTurn(disabledProvider, {
  session,
  students: [distractedStudent],
  teacherText: "小明，你能接着说说刚才我们第一步做什么吗？",
  runtimeStates,
  recentEvents
});

assert.equal(namedTurn.usedModel, false);
assert.equal(namedTurn.result.messages.length, 1);
assert.match(namedTurn.result.messages[0].content, /小明|我/);
assert.match(namedTurn.result.messages[0].content, /第一步|关键词|刚才/);
assert.match(namedTurn.result.messages[0].content, /关键词|限定词/);
assert.match(namedTurn.result.suggestion, /小明|走神|拉回|确认/);
assert.doesNotMatch(namedTurn.result.messages[0].content, /鍚|锛|妯|绾/);

const challengeTurn = await generateAiStudentTurn(disabledProvider, {
  session,
  students: [challengeStudent],
  teacherText: "这个限定词是不是任何情况下都不能删？",
  runtimeStates,
  recentEvents: []
});

assert.match(challengeTurn.result.messages[0].content, /如果|是不是|边界|例外|条件/);
assert.match(challengeTurn.result.suggestion, /追问|边界|全班|任务/);

const activeStudent: StudentAgent = {
  id: "student-yuqing",
  name: "雨晴",
  avatar: "积极型",
  personality: "愿意举手表达，能带动课堂气氛。",
  foundation: 78,
  attention: 82,
  comprehension: 74,
  participation: 86,
  behaviorStyle: "主动回应，偶尔抢答。",
  status: "投入",
  strategy: "让她先说思路，再请其他学生补充。",
  createdAt: now
};

const activeTurn = await generateAiStudentTurn(disabledProvider, {
  session,
  students: [activeStudent],
  teacherText: "雨晴，你来补充一下你的想法。",
  runtimeStates: [
    {
      sessionId: session.id,
      studentId: activeStudent.id,
      attention: 84,
      comprehension: 78,
      participation: 89,
      emotion: "想举手回应",
      pose: "smiling",
      statusText: "想举手回应",
      memory: ["刚才已经说过可以先找关键词。"],
      updatedAt: now
    }
  ],
  recentEvents
});

assert.equal(activeTurn.result.messages.length, 1);
assert.doesNotMatch(activeTurn.result.messages[0].content, /走神|漏听/);
assert.doesNotMatch(activeTurn.result.messages[0].content, /雨晴，你来/);
assert.match(activeTurn.result.messages[0].content, /我觉得|可以|先|补充|思路/);

const activeTurnWithoutMemory = await generateAiStudentTurn(disabledProvider, {
  session,
  students: [activeStudent],
  teacherText: "雨晴，你来补充一下刚才第一步应该看哪里。",
  runtimeStates: [
    {
      sessionId: session.id,
      studentId: activeStudent.id,
      attention: 84,
      comprehension: 78,
      participation: 89,
      emotion: "想举手回应",
      pose: "smiling",
      statusText: "想举手回应",
      memory: [],
      updatedAt: now
    }
  ],
  recentEvents: []
});

assert.doesNotMatch(activeTurnWithoutMemory.result.messages[0].content, /雨晴，你来/);
assert.match(activeTurnWithoutMemory.result.messages[0].content, /关键词|第一步|限定词/);

const prompt = buildStudentTurnPrompt({
  session,
  students: [distractedStudent, challengeStudent],
  teacherText: "刚才这句话里的“几乎”能不能删？",
  runtimeStates,
  recentEvents
});
const promptBody = prompt.messages.map((message) => message.content).join("\n");
assert.match(promptBody, /课堂运行态/);
assert.match(promptBody, /刚才漏听了第一步/);
assert.match(promptBody, /最近课堂事件/);
assert.match(promptBody, /先找关键词/);

console.log("Agent dialogue contract passed.");

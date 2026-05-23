import assert from "node:assert/strict";
import type { AiStudentMessage } from "../src/server/ai/provider.js";
import {
  advanceRuntimeTick,
  applyStudentMessagesToRuntime,
  createInitialRuntimeState,
  inferRuntimePose,
  selectStudentsForTurn
} from "../src/server/services/studentState.js";
import type { StudentAgent } from "../src/shared/types.js";

const now = "2026-05-24T08:00:00.000Z";

const students: StudentAgent[] = [
  {
    id: "s-low-attention",
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
  },
  {
    id: "s-challenge",
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
  },
  {
    id: "s-active",
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
  }
];

const initialStates = students.map((student) => createInitialRuntimeState("session-1", student, now));

assert.equal(initialStates[0].studentId, "s-low-attention");
assert.equal(initialStates[0].attention, 36);
assert.equal(initialStates[0].pose, "distracted");
assert.match(initialStates[0].statusText, /走神|注意/);

const selected = selectStudentsForTurn(
  students,
  initialStates,
  "小明，你来试着说说刚才这一步为什么成立？",
  2
);

assert.equal(selected[0].id, "s-low-attention");
assert.equal(selected.length, 2);

const messages: AiStudentMessage[] = [
  {
    studentId: "s-low-attention",
    studentName: "小明",
    content: "老师，我刚才有点走神，现在想确认第一步是不是先找关键词。",
    mood: "回到课堂"
  }
];

const updated = applyStudentMessagesToRuntime(initialStates, messages, "2026-05-24T08:01:00.000Z");
const lowAttention = updated.find((state) => state.studentId === "s-low-attention");
assert.ok(lowAttention);
assert.equal(lowAttention.pose, "distracted");
assert.equal(lowAttention.lastSpokeAt, "2026-05-24T08:01:00.000Z");
assert.match(lowAttention.statusText, /走神|确认|课堂/);
assert.equal(lowAttention.memory.length, 1);
assert.match(lowAttention.memory[0], /第一步/);

const ticked = advanceRuntimeTick(updated, students, "2026-05-24T08:01:08.000Z");
assert.equal(ticked.states.length, 3);
assert.ok(ticked.events.some((event) => event.type === "student_state_change"));
assert.ok(ticked.states.some((state) => state.statusText !== initialStates.find((item) => item.studentId === state.studentId)?.statusText));

assert.equal(
  inferRuntimePose("听不懂时会沉默，需要具体例子。", {
    ...students[0],
    attention: 66,
    status: "困惑",
    behaviorStyle: "听不懂时沉默，需要具体例子。"
  }),
  "confused"
);

console.log("Agent runtime contract passed.");

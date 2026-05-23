import type {
  ClassroomEvent,
  StudentAgent,
  StudentRuntimePose,
  StudentRuntimeState
} from "../../shared/types.js";
import type { AiStudentMessage } from "../ai/provider.js";

type StateEventDraft = Omit<ClassroomEvent, "id">;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function inferRuntimePose(text: string, student?: StudentAgent): StudentRuntimePose {
  const source = `${text} ${student?.status ?? ""} ${student?.personality ?? ""} ${student?.behaviorStyle ?? ""}`;
  const activeSource = `${text} ${student?.status ?? ""}`;
  if (/质疑|挑战|为什么|如果|边界|例外|反问/.test(source)) return "challenging";
  if (/走神|发呆|分心|低头|漂移/.test(activeSource) || (student?.attention ?? 100) < 45) return "distracted";
  if (/困惑|不懂|跟不上|不会|听不懂|卡住|确认/.test(activeSource)) return "confused";
  if (/困惑|不懂|跟不上|不会|听不懂|卡住|确认/.test(source)) return "confused";
  if (/走神|发呆|分心|低头|漂移/.test(source)) return "distracted";
  if (/举手|积极|抢答|主动|回应|补充|说思路/.test(source) || (student?.participation ?? 0) > 80) return "smiling";
  if (/思考|慢热|观察|等待|安静|组织/.test(source) || (student?.comprehension ?? 100) < 55) return "thinking";
  return "listening";
}

function statusTextForPose(pose: StudentRuntimePose, text = "") {
  if (/确认|第一步|刚才/.test(text)) return "正在确认刚才的步骤";
  switch (pose) {
    case "smiling":
      return "想举手回应";
    case "thinking":
      return "正在组织回答";
    case "confused":
      return "有点听不懂";
    case "distracted":
      return "注意力有点走神";
    case "challenging":
      return "准备追问边界";
    default:
      return "专注听讲中";
  }
}

export function createInitialRuntimeState(
  sessionId: string,
  student: StudentAgent,
  timestamp = new Date().toISOString()
): StudentRuntimeState {
  const pose = inferRuntimePose(student.status, student);
  return {
    sessionId,
    studentId: student.id,
    attention: clamp(student.attention),
    comprehension: clamp(student.comprehension),
    participation: clamp(student.participation),
    emotion: student.status || "观察",
    pose,
    statusText: statusTextForPose(pose),
    memory: [],
    updatedAt: timestamp
  };
}

export function selectStudentsForTurn(
  students: StudentAgent[],
  states: StudentRuntimeState[],
  teacherText: string,
  maxStudents = 4
) {
  const stateByStudent = new Map(states.map((state) => [state.studentId, state]));
  return [...students]
    .map((student, index) => {
      const state = stateByStudent.get(student.id);
      const named = teacherText.includes(student.name);
      const score =
        (named ? 1000 : 0) +
        (state && state.attention < 48 ? 120 : 0) +
        (state && state.comprehension < 55 ? 90 : 0) +
        (state?.pose === "challenging" ? 80 : 0) +
        (state?.pose === "smiling" ? 50 : 0) +
        (student.participation > 80 ? 35 : 0) +
        Math.max(0, 35 - index);
      return { student, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, maxStudents)
    .map((item) => item.student);
}

function applyMessageToState(
  state: StudentRuntimeState,
  message: AiStudentMessage,
  timestamp: string
): StudentRuntimeState {
  const pose = inferRuntimePose(`${message.mood} ${message.content}`);
  const attentionDelta = pose === "distracted" ? 5 : 8;
  const comprehensionDelta = pose === "confused" ? -4 : 4;
  const participationDelta = pose === "smiling" || pose === "challenging" ? 8 : 4;
  return {
    ...state,
    attention: clamp(state.attention + attentionDelta),
    comprehension: clamp(state.comprehension + comprehensionDelta),
    participation: clamp(state.participation + participationDelta),
    emotion: message.mood || state.emotion,
    pose,
    statusText: statusTextForPose(pose, message.content),
    memory: [...state.memory.slice(-2), message.content.slice(0, 64)],
    lastSpokeAt: timestamp,
    updatedAt: timestamp
  };
}

export function applyStudentMessagesToRuntime(
  states: StudentRuntimeState[],
  messages: AiStudentMessage[],
  timestamp = new Date().toISOString()
): StudentRuntimeState[] {
  const messageByStudent = new Map(messages.map((message) => [message.studentId, message]));
  return states.map((state) => {
    const message = messageByStudent.get(state.studentId);
    return message ? applyMessageToState(state, message, timestamp) : state;
  });
}

function buildStateEvent(state: StudentRuntimeState, student?: StudentAgent): StateEventDraft {
  return {
    sessionId: state.sessionId,
    type: "student_state_change",
    actor: student?.name ?? "AI学生",
    content: state.statusText,
    timestamp: state.updatedAt,
    metadata: {
      studentId: state.studentId,
      pose: state.pose,
      attention: state.attention,
      comprehension: state.comprehension,
      participation: state.participation,
      emotion: state.emotion,
      statusText: state.statusText
    }
  };
}

export function buildRuntimeStateEvents(
  previous: StudentRuntimeState[],
  next: StudentRuntimeState[],
  students: StudentAgent[]
) {
  const previousByStudent = new Map(previous.map((state) => [state.studentId, state]));
  const studentsById = new Map(students.map((student) => [student.id, student]));
  return next
    .filter((state) => {
      const old = previousByStudent.get(state.studentId);
      return old?.pose !== state.pose || old?.statusText !== state.statusText || old?.lastSpokeAt !== state.lastSpokeAt;
    })
    .map((state) => buildStateEvent(state, studentsById.get(state.studentId)));
}

export function advanceRuntimeTick(
  states: StudentRuntimeState[],
  students: StudentAgent[],
  timestamp = new Date().toISOString()
): { states: StudentRuntimeState[]; events: StateEventDraft[] } {
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const next = states.map((state, index) => {
    const student = studentsById.get(state.studentId);
    const drift = index % 2 === 0 ? -3 : -1;
    const attention = clamp(state.attention + drift);
    const comprehension = clamp(state.comprehension + (attention < 45 ? -2 : 1));
    const participation = clamp(state.participation + (state.pose === "smiling" ? 2 : -1));
    const passiveText =
      attention < 45
        ? "开始走神，需要拉回注意力"
        : comprehension < 52
          ? "眉头紧皱，有点困惑"
          : participation > 78
            ? "想举手补充"
            : index % 3 === 0
              ? "正在组织回答"
              : "专注听讲中";
    const pose = inferRuntimePose(passiveText, student);
    return {
      ...state,
      attention,
      comprehension,
      participation,
      pose,
      statusText: passiveText,
      emotion: passiveText,
      updatedAt: timestamp
    };
  });

  return {
    states: next,
    events: buildRuntimeStateEvents(states, next, students)
  };
}

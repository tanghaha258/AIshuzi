import type { ClassroomEvent, ClassroomMetrics } from "../../shared/types.js";
import type { GenerateStudentContext } from "./provider.js";

export type ProviderScenario = "student-turn" | "lesson-plan" | "report";

export interface PromptBundle {
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  successMessage: string;
}

export function buildStudentTurnPrompt(context: GenerateStudentContext): PromptBundle {
  const runtimeStates = context.runtimeStates?.map((state) => ({
    studentId: state.studentId,
    attention: state.attention,
    comprehension: state.comprehension,
    participation: state.participation,
    pose: state.pose,
    emotion: state.emotion,
    statusText: state.statusText,
    memory: state.memory.slice(-3),
    lastSpokeAt: state.lastSpokeAt
  })) ?? [];
  const recentEvents = context.recentEvents?.slice(-8).map((event) => ({
    type: event.type,
    actor: event.actor,
    content: event.content,
    timestamp: event.timestamp
  })) ?? [];

  return {
    maxTokens: 700,
    successMessage: "AI学生回应 JSON 生成正常。",
    messages: [
      {
        role: "system",
        content: "你是师范生微格教学实训平台里的课堂模拟引擎。你必须只输出 JSON 对象，不要输出 Markdown。"
      },
      {
        role: "user",
        content: [
          "请基于教师发言和学生画像，生成 2-4 个 AI学生的真实课堂反应，并给教师一条即时教学策略建议。",
          "每个学生的回应必须延续自己的课堂运行态、上一轮记忆和最近事件，不要把所有学生写成同一种口吻。",
          "输出 JSON 格式必须严格符合：",
          '{"messages":[{"studentId":"...","studentName":"...","content":"...","mood":"..."}],"suggestion":"..."}',
          `课程：${context.session.courseTitle}`,
          `主题：${context.session.topic}`,
          `教师发言：${context.teacherText}`,
          `学生画像：${JSON.stringify(
            context.students.map((student) => ({
              studentId: student.id,
              studentName: student.name,
              personality: student.personality,
              foundation: student.foundation,
              attention: student.attention,
              comprehension: student.comprehension,
              participation: student.participation,
              behaviorStyle: student.behaviorStyle,
              status: student.status
            }))
          )}`,
          `课堂运行态：${JSON.stringify(runtimeStates)}`,
          `最近课堂事件：${JSON.stringify(recentEvents)}`
        ].join("\n")
      }
    ]
  };
}

export function buildLessonPlanPrompt(input: {
  subject: string;
  grade: string;
  topic: string;
  objectives: string;
  durationMinutes: number;
}): PromptBundle {
  return {
    maxTokens: 900,
    successMessage: "备课方案 JSON 生成正常。",
    messages: [
      {
        role: "system",
        content: "你是中文微格教学备课助手。你必须只输出 JSON 对象，不要输出 Markdown。"
      },
      {
        role: "user",
        content: [
          "请生成一份可直接用于微格试讲的备课方案。",
          "输出 JSON 格式必须严格符合：",
          '{"title":"...","objectives":["..."],"stages":[{"name":"导入","minutes":2,"teacherAction":"...","studentExpected":"..."}],"interactionRisks":["..."],"recommendedStudentAgents":["..."]}',
          `学科：${input.subject}`,
          `年级：${input.grade}`,
          `主题：${input.topic}`,
          `目标：${input.objectives}`,
          `时长：${input.durationMinutes} 分钟`
        ].join("\n")
      }
    ]
  };
}

export function buildReportPrompt(input: {
  courseTitle: string;
  topic: string;
  metrics: ClassroomMetrics;
  events: ClassroomEvent[];
}): PromptBundle {
  return {
    maxTokens: 900,
    successMessage: "课后报告 JSON 生成正常。",
    messages: [
      {
        role: "system",
        content: "你是师范生微格试讲评价专家。你必须只输出 JSON 对象，不要输出 Markdown。"
      },
      {
        role: "user",
        content: [
          "请基于课堂指标和关键事件生成课后诊断。",
          "输出 JSON 格式必须严格符合：",
          '{"summary":"...","strengths":["..."],"improvements":["..."],"keyMoments":["..."]}',
          `课程：${input.courseTitle}`,
          `主题：${input.topic}`,
          `指标：${JSON.stringify(input.metrics)}`,
          `事件：${JSON.stringify(input.events.slice(-8).map((event) => ({ type: event.type, actor: event.actor, content: event.content })))}`
        ].join("\n")
      }
    ]
  };
}

export function buildProviderScenarioPrompt(scenario: ProviderScenario): PromptBundle {
  if (scenario === "lesson-plan") {
    return buildLessonPlanPrompt({
      subject: "数学",
      grade: "八年级",
      topic: "勾股定理的生活化理解",
      objectives: "学生能够说出直角三角形三边关系，并用一个生活例子解释定理。",
      durationMinutes: 10
    });
  }

  if (scenario === "report") {
    return buildReportPrompt({
      courseTitle: "勾股定理及其应用",
      topic: "勾股定理的生活化理解",
      metrics: {
        attention: 72,
        confusion: 28,
        interaction: 76,
        pace: 70,
        clarity: 74,
        questioning: 66,
        engagement: 71
      },
      events: [
        {
          id: "sample-1",
          sessionId: "sample",
          type: "teacher_utterance",
          actor: "教师",
          content: "谁能说说直角三角形里最长的边是哪一条？",
          timestamp: new Date(0).toISOString(),
          metadata: {}
        },
        {
          id: "sample-2",
          sessionId: "sample",
          type: "student_question",
          actor: "思源",
          content: "如果不是直角三角形还能用这个公式吗？",
          timestamp: new Date(0).toISOString(),
          metadata: {}
        }
      ]
    });
  }

  return buildStudentTurnPrompt({
    session: {
      id: "sample",
      courseId: "sample-course",
      courseTitle: "勾股定理及其应用",
      topic: "勾股定理的生活化理解",
      status: "active",
      selectedStudentIds: ["s1", "s2"],
      createdAt: new Date(0).toISOString()
    },
    teacherText: "同学们，谁能说说直角三角形里最长的边是哪一条？",
    students: [
      {
        id: "s1",
        name: "小明",
        avatar: "走神型",
        personality: "注意力容易漂移，但被点名后能跟上基础问题。",
        foundation: 56,
        attention: 42,
        comprehension: 48,
        participation: 35,
        behaviorStyle: "容易低头走神，需要明确任务牵引。",
        status: "走神",
        strategy: "用短问题拉回注意力。",
        createdAt: new Date(0).toISOString()
      },
      {
        id: "s2",
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
        createdAt: new Date(0).toISOString()
      }
    ]
  });
}

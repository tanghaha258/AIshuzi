import type {
  GenerateLessonPlanPayload,
  LessonPlanDraft,
  LessonPlanStage,
  LessonPlanStageType,
  ModelProviderConfig,
  PlannedClassroomIncident,
  PlannedIncidentType,
  StudentAgent
} from "../../shared/types.js";
import { callJsonCompletion } from "../ai/provider.js";
import { buildLessonPlanPrompt } from "../ai/prompts.js";

const stageTypes: LessonPlanStageType[] = ["导入", "讲解", "提问", "练习", "总结"];
const incidentTypes: PlannedIncidentType[] = ["听不懂", "抢答", "质疑", "沉默", "跑题"];

type GeneratedBy = LessonPlanDraft["generatedBy"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: unknown, fallback: string, maxLength = 180) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function distributeMinutes(durationMinutes: number) {
  const total = clamp(Math.round(durationMinutes || 10), 5, 45);
  const weights = [0.16, 0.28, 0.2, 0.22, 0.14];
  const minutes = weights.map((weight) => Math.max(1, Math.floor(total * weight)));
  let diff = total - minutes.reduce((sum, item) => sum + item, 0);
  const growOrder = [1, 3, 2, 0, 4];
  let cursor = 0;
  while (diff > 0) {
    minutes[growOrder[cursor % growOrder.length]] += 1;
    diff -= 1;
    cursor += 1;
  }
  const shrinkOrder = [1, 3, 2, 0, 4];
  while (diff < 0) {
    const index = shrinkOrder.find((item) => minutes[item] > 1);
    if (index === undefined) break;
    minutes[index] -= 1;
    diff += 1;
  }
  return minutes;
}

function splitObjectives(objectives: string) {
  const parts = objectives
    .split(/[；;。.\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 4) : ["完成一个聚焦明确的微格试讲片段", "通过即时提问确认学生理解"];
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function profileText(student: StudentAgent) {
  return `${student.avatar} ${student.personality} ${student.behaviorStyle} ${student.status} ${student.strategy}`;
}

export function recommendStudentsForLesson(students: StudentAgent[], maxStudents = 6): StudentAgent[] {
  const selected: StudentAgent[] = [];
  const add = (candidate?: StudentAgent) => {
    if (candidate && !selected.some((student) => student.id === candidate.id) && selected.length < maxStudents) {
      selected.push(candidate);
    }
  };

  const sortedBy = (score: (student: StudentAgent) => number, filter: (student: StudentAgent) => boolean = () => true) =>
    students.filter(filter).sort((left, right) => score(right) - score(left))[0];

  add(sortedBy((student) => 100 - student.attention, (student) => student.attention < 60 || hasAny(profileText(student), ["走神", "漏听", "低头"])));
  add(sortedBy((student) => 120 - student.comprehension - student.foundation * 0.2, (student) => student.comprehension < 60 || student.foundation < 55 || hasAny(profileText(student), ["薄弱", "听不懂", "困惑"])));
  add(sortedBy((student) => student.comprehension + student.participation, (student) => hasAny(profileText(student), ["挑战", "质疑", "追问", "边界", "例外"])));
  add(sortedBy((student) => student.participation + student.attention * 0.4, (student) => student.participation >= 70 || hasAny(profileText(student), ["积极", "投入", "举手", "抢答"])));
  add(sortedBy((student) => 100 - student.participation, (student) => student.participation < 45 || hasAny(profileText(student), ["内向", "观望", "不主动"])));
  add(sortedBy((student) => 100 - student.attention + student.participation * 0.2, (student) => hasAny(profileText(student), ["粗心", "跳步", "急躁", "快答快错"])));

  const fill = [...students].sort((left, right) => {
    const score = (student: StudentAgent) =>
      Math.abs(65 - student.foundation) +
      Math.abs(65 - student.attention) +
      Math.abs(65 - student.comprehension) +
      Math.abs(65 - student.participation);
    return score(right) - score(left);
  });
  for (const student of fill) {
    add(student);
  }

  return selected.slice(0, Math.min(maxStudents, students.length));
}

function defaultStages(input: GenerateLessonPlanPayload): LessonPlanStage[] {
  const minutes = distributeMinutes(input.durationMinutes);
  return [
    {
      id: "stage-intro",
      type: "导入",
      name: "导入：抛出真实情境",
      minutes: minutes[0],
      teacherAction: `用一个贴近学生生活的问题引出“${input.topic}”，让学生先说直觉判断。`,
      expectedStudentResponse: "学生能说出已有经验，出现一两个不完整或模糊的判断。",
      strategyTip: "先收集想法，不急着纠错，把差异留给后续讲解。"
    },
    {
      id: "stage-explain",
      type: "讲解",
      name: "讲解：拆开关键概念",
      minutes: minutes[1],
      teacherAction: "围绕教学目标拆解关键步骤，用板书或课件标出判断依据。",
      expectedStudentResponse: "多数学生能跟上主线，薄弱学生可能需要具体例子辅助。",
      strategyTip: "每讲完一个关键点就用一句封闭式小问题确认理解。"
    },
    {
      id: "stage-question",
      type: "提问",
      name: "提问：触发差异回应",
      minutes: minutes[2],
      teacherAction: "点名不同画像的学生回答，让积极型先说思路，再请薄弱型复述关键一步。",
      expectedStudentResponse: "学生出现抢答、迟疑、追问或走神回归等真实课堂反应。",
      strategyTip: "把学生回答转化为全班可判断的问题，避免只和一个学生来回对话。"
    },
    {
      id: "stage-practice",
      type: "练习",
      name: "练习：即时应用",
      minutes: minutes[3],
      teacherAction: `给出一个微型练习，让学生用“${input.topic}”中的关键方法完成判断。`,
      expectedStudentResponse: "学生能尝试应用方法，粗心型可能跳步，挑战型可能提出边界条件。",
      strategyTip: "要求学生说出依据，不只报答案。"
    },
    {
      id: "stage-summary",
      type: "总结",
      name: "总结：固化策略",
      minutes: minutes[4],
      teacherAction: "请学生用一句话总结本节课的判断方法，并指出容易出错的一步。",
      expectedStudentResponse: "学生能复述核心方法，仍困惑的学生会暴露最后一个卡点。",
      strategyTip: "用学生语言收束课堂，再给出下一次练习任务。"
    }
  ];
}

function defaultIncidents(input: GenerateLessonPlanPayload): PlannedClassroomIncident[] {
  return [
    {
      id: "incident-confused",
      type: "听不懂",
      trigger: `讲解“${input.topic}”的关键判断依据时，薄弱型学生只点头但说不出原因。`,
      studentRole: "薄弱型学生",
      teacherStrategy: "换成生活化例子，拆成两步追问，并让学生复述第一步。"
    },
    {
      id: "incident-rush-answer",
      type: "抢答",
      trigger: "积极型学生在问题刚抛出时直接说答案。",
      studentRole: "积极型学生",
      teacherStrategy: "肯定参与意愿，但要求先说依据，再邀请另一名学生补充或质疑。"
    },
    {
      id: "incident-challenge",
      type: "质疑",
      trigger: "挑战型学生追问条件变化后结论是否仍成立。",
      studentRole: "挑战型学生",
      teacherStrategy: "把追问转成全班判断任务，明确本节课适用边界。"
    },
    {
      id: "incident-silence",
      type: "沉默",
      trigger: "内向型学生被点名后停顿较久。",
      studentRole: "内向型学生",
      teacherStrategy: "给 10 秒思考时间，允许先读出记录，再逐步追问理由。"
    },
    {
      id: "incident-off-topic",
      type: "跑题",
      trigger: "走神型学生把生活例子展开到无关细节。",
      studentRole: "走神型学生",
      teacherStrategy: "温和截停，用一个限定问题把注意力拉回课堂目标。"
    }
  ];
}

export function buildLocalLessonPlan(input: GenerateLessonPlanPayload, students: StudentAgent[]): LessonPlanDraft {
  const recommendedStudents = recommendStudentsForLesson(students, 6);
  return {
    title: input.title?.trim() || `${input.topic}微格试讲脚本`,
    overview: `围绕“${input.topic}”设计 ${input.durationMinutes} 分钟微格试讲，覆盖导入、讲解、提问、练习和总结，并预设学生差异反应。`,
    objectives: splitObjectives(input.objectives),
    stages: defaultStages(input),
    incidents: defaultIncidents(input),
    recommendedStudentIds: recommendedStudents.map((student) => student.id),
    generatedBy: "local"
  };
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function normalizeStageType(value: unknown, index: number): LessonPlanStageType {
  const text = typeof value === "string" ? value : "";
  return stageTypes.find((type) => text.includes(type)) ?? stageTypes[index] ?? "讲解";
}

function normalizeIncidentType(value: unknown, index: number): PlannedIncidentType {
  const text = typeof value === "string" ? value : "";
  return incidentTypes.find((type) => text.includes(type)) ?? incidentTypes[index] ?? "听不懂";
}

function rebalanceStages(stages: LessonPlanStage[], durationMinutes: number) {
  const minutes = distributeMinutes(durationMinutes);
  return stages.map((stage, index) => ({
    ...stage,
    minutes: minutes[index] ?? 1
  }));
}

export function normalizeLessonPlanResult(
  raw: Record<string, unknown>,
  input: GenerateLessonPlanPayload,
  students: StudentAgent[],
  generatedBy: GeneratedBy = "local"
): LessonPlanDraft {
  const local = buildLocalLessonPlan(input, students);
  const rawStages = asObjectArray(raw.stages);
  const stages = stageTypes.map((type, index) => {
    const source =
      rawStages.find((stage) => normalizeStageType(stage.type ?? stage.name, index) === type) ??
      rawStages[index] ??
      {};
    const fallback = local.stages[index];
    return {
      id: fallback.id,
      type,
      name: cleanText(source.name, fallback.name, 40),
      minutes: Number(source.minutes) || fallback.minutes,
      teacherAction: cleanText(source.teacherAction ?? source.teacher_action, fallback.teacherAction),
      expectedStudentResponse: cleanText(
        source.expectedStudentResponse ?? source.studentExpected ?? source.expected_student_response,
        fallback.expectedStudentResponse
      ),
      strategyTip: cleanText(source.strategyTip ?? source.strategy_tip, fallback.strategyTip)
    };
  });

  const rawIncidents = asObjectArray(raw.incidents ?? raw.plannedIncidents ?? raw.interactionRisks);
  const incidentSources: Record<string, unknown>[] = rawIncidents.length
    ? rawIncidents
    : local.incidents.map((incident) => ({ ...incident }));
  const incidents = incidentSources.map((incident, index) => {
    const fallback = local.incidents[index % local.incidents.length];
    const type = normalizeIncidentType(incident.type, index);
    return {
      id: fallback.id || `incident-${index + 1}`,
      type,
      trigger: cleanText(incident.trigger, fallback.trigger),
      studentRole: cleanText(incident.studentRole ?? incident.student_role, fallback.studentRole, 40),
      teacherStrategy: cleanText(incident.teacherStrategy ?? incident.teacher_strategy, fallback.teacherStrategy)
    };
  });

  while (incidents.length < 4) {
    incidents.push(local.incidents[incidents.length]);
  }

  const studentIds = new Set(students.map((student) => student.id));
  const rawRecommended = Array.isArray(raw.recommendedStudentIds ?? raw.recommended_student_ids)
    ? (raw.recommendedStudentIds ?? raw.recommended_student_ids)
    : [];
  const recommendedStudentIds = unique(
    (rawRecommended as unknown[])
      .map((id) => String(id))
      .filter((id) => studentIds.has(id))
  );

  return {
    title: cleanText(raw.title, local.title, 80),
    overview: cleanText(raw.overview ?? raw.summary, local.overview, 260),
    objectives: Array.isArray(raw.objectives)
      ? raw.objectives.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : local.objectives,
    stages: rebalanceStages(stages, input.durationMinutes),
    incidents: incidents.slice(0, 5),
    recommendedStudentIds: recommendedStudentIds.length ? recommendedStudentIds : local.recommendedStudentIds,
    generatedBy
  };
}

export async function generateLessonPlan(
  config: ModelProviderConfig,
  input: GenerateLessonPlanPayload,
  students: StudentAgent[]
): Promise<{ usedModel: boolean; planDraft: LessonPlanDraft }> {
  if (!config.enabled || !config.apiKey || !config.baseURL || !config.model) {
    return { usedModel: false, planDraft: buildLocalLessonPlan(input, students) };
  }

  try {
    const prompt = buildLessonPlanPrompt(input, students);
    const raw = await callJsonCompletion<Record<string, unknown>>(config, prompt.messages, { maxTokens: prompt.maxTokens });
    return {
      usedModel: true,
      planDraft: normalizeLessonPlanResult(raw, input, students, "model")
    };
  } catch {
    return { usedModel: false, planDraft: buildLocalLessonPlan(input, students) };
  }
}

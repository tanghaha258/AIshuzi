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
import { summarizeModelFailure } from "../ai/observability.js";
import { callJsonCompletion, validateProviderConfig } from "../ai/provider.js";
import { buildLessonPlanPrompt } from "../ai/prompts.js";

const stageTypes: LessonPlanStageType[] = ["导入", "讲解", "提问", "练习", "总结"];
const incidentTypes: PlannedIncidentType[] = ["听不懂", "抢答", "质疑", "沉默", "跑题"];
const defaultTeachingMethods: Record<LessonPlanStageType, string> = {
  导入: "情境导入法",
  讲解: "支架式讲解",
  提问: "问题链教学",
  练习: "即时诊断与变式练习",
  总结: "归纳建构法"
};

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

function topicKind(input: GenerateLessonPlanPayload) {
  const text = `${input.subject} ${input.topic} ${input.lesson ?? ""}`;
  if (/一元二次|二次方程|quadratic/i.test(text)) return "quadratic";
  if (/勾股|直角|斜边|三角形/.test(text)) return "pythagorean";
  if (/说明文|限定词|准确性|语言/.test(text)) return "expository";
  return "generic";
}

function concreteStageDetails(input: GenerateLessonPlanPayload): Record<LessonPlanStageType, { teacherAction: string; actionScript: string }> {
  const topic = input.topic || input.lesson || "本课主题";
  const kind = topicKind(input);

  if (kind === "quadratic") {
    return {
      导入: {
        teacherAction: "提出劳动实践田面积问题，引导学生把未知宽设为 x。",
        actionScript: "老师出示情境题：班级要整理一块面积 48 平方米的长方形劳动实践田，长比宽多 4 米。请学生先估一估宽是多少，再追问：如果把宽设为 x 米，长应该怎么表示？方程该怎么列？"
      },
      讲解: {
        teacherAction: "用板书把生活条件转化为一元二次方程。",
        actionScript: "板书：宽 = x，长 = x + 4，面积 = x(x + 4) = 48。教师边写边问：x 表示什么？x + 4 来自哪句话？为什么面积要用长乘宽？再整理为 x² + 4x - 48 = 0。"
      },
      提问: {
        teacherAction: "用连续追问检查学生是否理解每一项的实际意义。",
        actionScript: "点名提问：阿哲，你能说说 x² 这一项来自哪里吗？雨晴，请补充 4x 表示哪一段条件。思源追问：如果长比宽多 6 米，方程中哪一项会改变？"
      },
      练习: {
        teacherAction: "给出变式情境，让学生独立列方程而不是直接套模板。",
        actionScript: "屏幕给出变式：一块面积 60 平方米的矩形展板，长比宽多 7 米。学生 30 秒独立写出设元和方程；教师巡视后请一名学生读出：设宽为 x，则 x(x + 7) = 60。"
      },
      总结: {
        teacherAction: "让学生用三句话归纳从实际问题到方程的步骤。",
        actionScript: "教师收束：请学生补全板书句式：第一，找未知量并设为 x；第二，把另一个量用含 x 的式子表示；第三，根据面积、数量或总价关系列方程。最后让学生指出今天最容易漏写的是哪一步。"
      }
    };
  }

  if (kind === "pythagorean") {
    return {
      导入: {
        teacherAction: "提出校园路线问题，让学生估计直角三角形的最短路。",
        actionScript: "老师出示：操场从东门到北门，沿两条直路分别是 30 米和 40 米，如果沿对角线铺一条小路，至少要铺多少米？请学生先不用公式估一估，再说理由。"
      },
      讲解: {
        teacherAction: "用图形标出直角边和斜边，板书三边关系。",
        actionScript: "教师画直角三角形，标出 30、40、c，追问：哪两条边夹成直角？最长边是哪条？板书 30² + 40² = c²，计算 900 + 1600 = 2500，所以 c = 50。"
      },
      提问: {
        teacherAction: "用点名复述检查学生是否能判断适用条件。",
        actionScript: "教师点名：小明，请指出哪条是斜边；阿哲，请说出为什么不能把 30² + c² = 40²；思源，如果不是直角三角形还能这样算吗？把追问转给全班判断。"
      },
      练习: {
        teacherAction: "给出数字变式，让学生先标边再计算。",
        actionScript: "学生完成 1 分钟练习：楼梯竖直高度 6 米、水平距离 8 米，扶手长度至少多少米？要求先在图上圈出直角，再写 6² + 8² = c²，最后得出 10 米。"
      },
      总结: {
        teacherAction: "让学生归纳勾股定理使用前的检查清单。",
        actionScript: "教师请学生齐读检查清单：先找直角，再找斜边，最后写两条直角边的平方和等于斜边平方。请一名学生说出今天最容易错的一步。"
      }
    };
  }

  if (kind === "expository") {
    return {
      导入: {
        teacherAction: "出示删改句，让学生比较限定词改变后的表达效果。",
        actionScript: "老师出示两句：原句“我国大多数地区夏季降水较多”，改句“我国地区夏季降水多”。请学生判断哪一句更准确，并圈出“大多数”“较”两个词。"
      },
      讲解: {
        teacherAction: "用原句和改句对照说明限定词的准确性。",
        actionScript: "板书三列：原句、删去限定词、表达变化。教师追问：删去“大多数”后是不是变成所有地区？删去“较”后程度有没有被说死？让学生把变化写在表格里。"
      },
      提问: {
        teacherAction: "点名不同学生解释限定词的作用。",
        actionScript: "教师点名：可欣先读出含限定词的句子；雨晴解释“大约”表示什么范围；思源追问如果删掉会不会造成事实错误，全班用举手判断。"
      },
      练习: {
        teacherAction: "给出新句子，让学生找词并说明不能删的理由。",
        actionScript: "练习句：这座桥全长约 1200 米，是本市目前主要交通通道之一。学生圈出“约”“目前”“主要”“之一”，任选一个写出：如果删去，意思会怎样变。"
      },
      总结: {
        teacherAction: "让学生用固定句式总结限定词的分析方法。",
        actionScript: "教师给出句式：这个词表示……，限制了……，如果删去就会……，所以体现说明文语言的准确性。请学生用该句式口头分析一个词。"
      }
    };
  }

  return {
    导入: {
      teacherAction: `围绕“${topic}”提出一个带条件的真实任务。`,
      actionScript: `老师出示任务卡：今天要解决“${topic}”中的一个真实问题。请学生先写下一个判断，再说明依据；教师追问：你用到的条件是哪一句？还有哪个条件没有用上？`
    },
    讲解: {
      teacherAction: "把任务条件拆成可观察、可判断的步骤。",
      actionScript: `板书三步：找条件、定方法、说依据。教师把“${topic}”中的关键词圈出来，请学生逐一说明每个关键词对应哪一步操作。`
    },
    提问: {
      teacherAction: "用点名和追问暴露学生理解差异。",
      actionScript: "教师先请积极学生说完整思路，再请薄弱学生复述第一步；如果学生只报答案，追问：你依据的是哪一个条件？如果条件变化，答案会不会变？"
    },
    练习: {
      teacherAction: "给出一个小变式，让学生当场迁移。",
      actionScript: `教师把原任务中的一个数字、对象或条件替换，形成 1 分钟变式练习。学生先独立写步骤，再同桌互查是否说清“条件-方法-结论”。`
    },
    总结: {
      teacherAction: "用学生语言整理本节课的可迁移方法。",
      actionScript: "教师请学生完成出口条：今天我学会的判断步骤是……；我最容易漏掉的是……；下次遇到相似题我先……。"
    }
  };
}

function defaultStages(input: GenerateLessonPlanPayload): LessonPlanStage[] {
  const minutes = distributeMinutes(input.durationMinutes);
  const details = concreteStageDetails(input);
  return [
    {
      id: "stage-intro",
      type: "导入",
      name: "导入：抛出真实情境",
      minutes: minutes[0],
      teachingMethod: defaultTeachingMethods["导入"],
      teacherAction: details["导入"].teacherAction,
      actionScript: details["导入"].actionScript,
      expectedStudentResponse: "学生能说出已有经验，出现一两个不完整或模糊的判断。",
      strategyTip: "先收集想法，不急着纠错，把差异留给后续讲解。"
    },
    {
      id: "stage-explain",
      type: "讲解",
      name: "讲解：拆开关键概念",
      minutes: minutes[1],
      teachingMethod: defaultTeachingMethods["讲解"],
      teacherAction: details["讲解"].teacherAction,
      actionScript: details["讲解"].actionScript,
      expectedStudentResponse: "多数学生能跟上主线，薄弱学生可能需要具体例子辅助。",
      strategyTip: "每讲完一个关键点就用一句封闭式小问题确认理解。"
    },
    {
      id: "stage-question",
      type: "提问",
      name: "提问：触发差异回应",
      minutes: minutes[2],
      teachingMethod: defaultTeachingMethods["提问"],
      teacherAction: details["提问"].teacherAction,
      actionScript: details["提问"].actionScript,
      expectedStudentResponse: "学生出现抢答、迟疑、追问或走神回归等真实课堂反应。",
      strategyTip: "把学生回答转化为全班可判断的问题，避免只和一个学生来回对话。"
    },
    {
      id: "stage-practice",
      type: "练习",
      name: "练习：即时应用",
      minutes: minutes[3],
      teachingMethod: defaultTeachingMethods["练习"],
      teacherAction: details["练习"].teacherAction,
      actionScript: details["练习"].actionScript,
      expectedStudentResponse: "学生能尝试应用方法，粗心型可能跳步，挑战型可能提出边界条件。",
      strategyTip: "要求学生说出依据，不只报答案。"
    },
    {
      id: "stage-summary",
      type: "总结",
      name: "总结：固化策略",
      minutes: minutes[4],
      teachingMethod: defaultTeachingMethods["总结"],
      teacherAction: details["总结"].teacherAction,
      actionScript: details["总结"].actionScript,
      expectedStudentResponse: "学生能复述核心方法，仍困惑的学生会暴露最后一个卡点。",
      strategyTip: "用学生语言收束课堂，再给出下一次练习任务。"
    }
  ];
}

function textbookContext(input: GenerateLessonPlanPayload) {
  return [input.textbookVersion, input.volume, input.unit, input.lesson, input.period]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" / ");
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
  const planningMode = input.planningMode === "textbook" ? "textbook" : "free-topic";
  const context = textbookContext(input);
  const modeOverview = planningMode === "textbook" && context
    ? `基于${context}，围绕“${input.topic}”设计 ${input.durationMinutes} 分钟微格试讲`
    : `围绕“${input.topic}”设计 ${input.durationMinutes} 分钟微格试讲`;
  return {
    title: input.title?.trim() || `${input.topic}微格试讲脚本`,
    overview: `${modeOverview}，覆盖导入、讲解、提问、练习和总结，并预设学生差异反应。`,
    objectives: splitObjectives(input.objectives),
    stages: defaultStages(input),
    incidents: defaultIncidents(input),
    recommendedStudentIds: recommendedStudents.map((student) => student.id),
    generatedBy: "local",
    planningMode,
    textbookVersion: input.textbookVersion?.trim() || undefined,
    volume: input.volume?.trim() || undefined,
    unit: input.unit?.trim() || undefined,
    lesson: input.lesson?.trim() || undefined,
    period: input.period?.trim() || undefined
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

function stringifyForAlignment(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyForAlignment).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(stringifyForAlignment).join(" ");
  }
  return "";
}

const alignmentStopWords = [
  "生活化",
  "理解",
  "应用",
  "初步",
  "认识",
  "讲解",
  "微格",
  "试讲",
  "脚本",
  "教学",
  "学习",
  "掌握"
];

function normalizedAlignmentText(value: string) {
  return value.replace(/\s+/g, "");
}

function topicKeywords(input: GenerateLessonPlanPayload) {
  const source = [input.topic, input.lesson, input.title]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" ");
  const pieces = source
    .split(/[的\s，。！？!?、；;：:（）()《》]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const keywords = pieces.flatMap((piece) => {
    const cleaned = alignmentStopWords.reduce((current, word) => current.replaceAll(word, ""), piece).trim();
    const conceptMatches = piece.match(/[一二三四五六七八九十]+元[一二三四五六七八九十]+次方程|[一二三四五六七八九十]+元方程|[一二三四五六七八九十]+次方程|勾股定理|乘法分配律|一次函数|二次函数/g) ?? [];
    return [piece, cleaned, ...conceptMatches];
  });

  return unique(keywords.map(normalizedAlignmentText).filter((keyword) => keyword.length >= 2 && !alignmentStopWords.includes(keyword)));
}

function isPlanAlignedWithTopic(raw: Record<string, unknown>, input: GenerateLessonPlanPayload) {
  const text = normalizedAlignmentText(stringifyForAlignment(raw));
  const kind = topicKind(input);
  if (kind === "quadratic") {
    return /一元二次|二次方程|方程|x²|x\^2|未知量|设为\s*x|设宽/.test(text);
  }
  if (kind === "pythagorean") {
    return /勾股|直角|斜边|直角边|平方和|c²|c\^2/.test(text);
  }
  if (kind === "expository") {
    return /说明文|限定词|准确性|删去|表达效果/.test(text);
  }

  const keywords = topicKeywords(input);
  return keywords.length === 0 || keywords.some((keyword) => text.includes(keyword));
}

export function normalizeLessonPlanResult(
  raw: Record<string, unknown>,
  input: GenerateLessonPlanPayload,
  students: StudentAgent[],
  generatedBy: GeneratedBy = "local"
): LessonPlanDraft {
  const local = buildLocalLessonPlan(input, students);
  if (generatedBy === "model" && !isPlanAlignedWithTopic(raw, input)) {
    return local;
  }
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
      teachingMethod: cleanText(source.teachingMethod ?? source.teaching_method, fallback.teachingMethod, 48),
      teacherAction: cleanText(source.teacherAction ?? source.teacher_action, fallback.teacherAction),
      actionScript: cleanText(
        source.actionScript ?? source.action_script ?? source.concreteAction ?? source.classroomScript,
        fallback.actionScript,
        360
      ),
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
    generatedBy,
    planningMode: local.planningMode,
    textbookVersion: local.textbookVersion,
    volume: local.volume,
    unit: local.unit,
    lesson: local.lesson,
    period: local.period
  };
}

export async function generateLessonPlan(
  config: ModelProviderConfig,
  input: GenerateLessonPlanPayload,
  students: StudentAgent[]
): Promise<{ usedModel: boolean; planDraft: LessonPlanDraft; fallbackReason?: string }> {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    return { usedModel: false, fallbackReason: validation.message, planDraft: buildLocalLessonPlan(input, students) };
  }

  try {
    const prompt = buildLessonPlanPrompt(input, students);
    const raw = await callJsonCompletion<Record<string, unknown>>(config, prompt.messages, {
      maxTokens: prompt.maxTokens,
      timeoutMs: 45000
    });
    const planDraft = normalizeLessonPlanResult(raw, input, students, "model");
    if (planDraft.generatedBy !== "model") {
      return {
        usedModel: false,
        fallbackReason: "模型返回内容与备课主题不一致，已切换为本地脚本。",
        planDraft
      };
    }
    return {
      usedModel: true,
      planDraft
    };
  } catch (error) {
    return { usedModel: false, fallbackReason: summarizeModelFailure(error), planDraft: buildLocalLessonPlan(input, students) };
  }
}

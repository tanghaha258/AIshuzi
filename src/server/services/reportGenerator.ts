import { randomUUID } from "node:crypto";
import type {
  ClassroomEvent,
  ClassroomMetrics,
  EvaluationReport,
  EvidenceBoundRecommendation,
  ModelProviderConfig,
  ReportEvidenceNode,
  ReportTimelineItem,
  StudentAgent,
  StudentResponseSummary,
  TeacherStrategyHit,
  TrainingSession
} from "../../shared/types.js";
import { callJsonCompletion, validateProviderConfig } from "../ai/provider.js";
import { summarizeModelFailure } from "../ai/observability.js";
import { calculateMetrics } from "../domain/simulation.js";

interface ReportInput {
  session: TrainingSession;
  events: ClassroomEvent[];
  students: StudentAgent[];
  generatedAt?: string;
}

interface GenerateReportInput extends ReportInput {
  provider: ModelProviderConfig;
}

interface ModelReportPatch {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendationDetails?: string[];
}

const importantTypes = new Set<ClassroomEvent["type"]>([
  "teacher_utterance",
  "student_response",
  "student_question",
  "student_distraction",
  "student_state_change",
  "teacher_observation",
  "system_suggestion"
]);

function clip(value: string, length: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function eventLabel(type: ClassroomEvent["type"]) {
  const labels: Record<ClassroomEvent["type"], string> = {
    teacher_utterance: "教师发言",
    transcript_segment: "语音转写",
    student_response: "学生回应",
    student_question: "学生提问",
    student_distraction: "走神信号",
    student_state_change: "状态变化",
    teacher_observation: "教师观察",
    system_suggestion: "教学建议",
    classroom_metric: "课堂指标",
    report_evidence: "报告证据"
  };
  return labels[type];
}

function evidenceReason(event: ClassroomEvent) {
  if (event.type === "student_question") return "学生主动暴露理解边界，是诊断课堂真实生成性的关键证据。";
  if (event.type === "student_response") return "学生回应可反映教师提问是否触发了有效参与。";
  if (event.type === "system_suggestion") return "系统建议记录了课堂即时调控点，可用于复盘教师策略命中。";
  if (event.type === "teacher_observation") return "教师观察指标用于判断讲台表现和镜头交流状态。";
  if (event.type === "student_state_change" || event.type === "student_distraction") return "学生状态变化体现注意力和理解阻滞。";
  if (event.type === "teacher_utterance") return "教师发言构成课堂推进和提问设计的直接证据。";
  return "课堂事件进入报告证据链。";
}

function evidenceWeight(event: ClassroomEvent) {
  if (event.type === "student_question" || event.type === "system_suggestion") return 90;
  if (event.type === "teacher_observation" || event.type === "student_state_change") return 76;
  if (event.type === "student_response") return 68;
  if (event.type === "teacher_utterance") return 62;
  return 50;
}

function isConfusionSignal(event: ClassroomEvent) {
  return /不懂|跟不上|困惑|不会|确认|走神|漏听|沉默|卡住/.test(event.content);
}

function isEngagementSignal(event: ClassroomEvent) {
  return /举手|补充|我觉得|能不能|为什么|如果|是不是|主动|回应/.test(event.content)
    || event.type === "student_response"
    || event.type === "student_question";
}

function minutesBetween(start?: string, end?: string) {
  const startMs = start ? new Date(start).getTime() : Number.NaN;
  const endMs = end ? new Date(end).getTime() : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

function buildOverview(session: TrainingSession, events: ClassroomEvent[]): EvaluationReport["overview"] {
  return {
    totalEvents: events.length,
    teacherTurns: events.filter((event) => event.type === "teacher_utterance").length,
    studentResponses: events.filter((event) => event.type === "student_response").length,
    studentQuestions: events.filter((event) => event.type === "student_question").length,
    systemSuggestions: events.filter((event) => event.type === "system_suggestion").length,
    teacherObservations: events.filter((event) => event.type === "teacher_observation").length,
    durationMinutes: minutesBetween(session.startedAt, session.endedAt)
  };
}

export function buildReportEvidence(events: ClassroomEvent[]): ReportEvidenceNode[] {
  const candidates = events
    .filter((event) => importantTypes.has(event.type))
    .filter((event) => event.content.trim())
    .map((event) => ({
      id: `evidence-${event.id}`,
      eventId: event.id,
      timestamp: event.timestamp,
      eventType: event.type,
      actor: event.actor,
      quote: clip(event.content, 90),
      reason: evidenceReason(event),
      weight: evidenceWeight(event)
    }));

  return candidates
    .sort((a, b) => b.weight - a.weight || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 16);
}

function createTimeline(evidence: ReportEvidenceNode[]): ReportTimelineItem[] {
  return evidence
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 8)
    .map((node) => ({
      time: new Date(node.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      title: `${eventLabel(node.eventType)} · ${node.actor}`,
      description: node.quote,
      evidenceEventId: node.eventId,
      eventType: node.eventType
    }));
}

function createStudentResponses(
  students: StudentAgent[],
  events: ClassroomEvent[]
): StudentResponseSummary[] {
  return students.map((student) => {
    const studentEvents = events.filter((event) => {
      const studentId = typeof event.metadata.studentId === "string" ? event.metadata.studentId : "";
      return studentId === student.id || event.actor === student.name;
    });
    const responseCount = studentEvents.filter((event) => event.type === "student_response").length;
    const questionCount = studentEvents.filter((event) => event.type === "student_question").length;
    const confusionSignals = studentEvents.filter(isConfusionSignal).length;
    const engagementSignals = studentEvents.filter(isEngagementSignal).length;
    const evidenceEventIds = studentEvents
      .filter((event) => event.type !== "classroom_metric")
      .slice(-4)
      .map((event) => event.id);
    const diagnosis = confusionSignals > 0
      ? `${student.name} 出现了 ${confusionSignals} 次理解阻滞，需要更多具象例子和步骤确认。`
      : engagementSignals > 0
        ? `${student.name} 能被问题带动参与，可继续用追问激发其表达。`
        : `${student.name} 的参与证据较少，后续可安排复述或小任务。`;

    return {
      studentId: student.id,
      studentName: student.name,
      profile: student.avatar || student.status,
      responseCount,
      questionCount,
      confusionSignals,
      engagementSignals,
      evidenceEventIds,
      diagnosis
    };
  });
}

function createStrategyHits(events: ClassroomEvent[]): TeacherStrategyHit[] {
  const suggestions = events.filter((event) => event.type === "system_suggestion");
  const teacherTurns = events.filter((event) => event.type === "teacher_utterance");
  const observationEvents = events.filter((event) => event.type === "teacher_observation");

  const hits: TeacherStrategyHit[] = suggestions.slice(-5).map((event) => ({
    strategy: clip(event.content, 80),
    matched: true,
    evidenceEventIds: [event.id],
    diagnosis: "课堂中出现即时调控提示，报告将其作为教师策略复盘节点。"
  }));

  if (teacherTurns.length) {
    hits.unshift({
      strategy: "短讲解与短提问推进",
      matched: teacherTurns.length >= 2,
      evidenceEventIds: teacherTurns.slice(0, 3).map((event) => event.id),
      diagnosis: teacherTurns.length >= 2
        ? "教师能持续抛出课堂任务，具备微格试讲的基本推进节奏。"
        : "教师发言证据较少，建议增加结构化追问。"
    });
  }

  if (observationEvents.length) {
    hits.push({
      strategy: "讲台状态本地观察",
      matched: true,
      evidenceEventIds: observationEvents.slice(-3).map((event) => event.id),
      diagnosis: "教师摄像头观察指标已进入报告证据链，可辅助复盘镜头交流与稳定性。"
    });
  }

  return hits.length ? hits : [{
    strategy: "课堂策略证据不足",
    matched: false,
    evidenceEventIds: events.slice(0, 1).map((event) => event.id),
    diagnosis: "当前事件不足以判断策略命中，建议延长试讲并增加师生互动。"
  }];
}

function evidenceForType(evidence: ReportEvidenceNode[], types: ClassroomEvent["type"][]) {
  const typeSet = new Set(types);
  return evidence.filter((node) => typeSet.has(node.eventType)).map((node) => node.eventId);
}

function createRecommendations(
  metrics: ClassroomMetrics,
  evidence: ReportEvidenceNode[],
  studentResponses: StudentResponseSummary[]
): EvidenceBoundRecommendation[] {
  const recommendations: EvidenceBoundRecommendation[] = [];
  const confusionEvidence = evidenceForType(evidence, ["student_question", "student_state_change", "student_distraction"]);
  const strategyEvidence = evidenceForType(evidence, ["system_suggestion"]);
  const teacherEvidence = evidenceForType(evidence, ["teacher_utterance", "teacher_observation"]);
  const mostConfused = studentResponses.find((student) => student.confusionSignals > 0);

  if (metrics.confusion > 35 || mostConfused) {
    recommendations.push({
      title: "把关键概念拆成可验证小步",
      detail: mostConfused
        ? `${mostConfused.studentName} 已出现理解阻滞，建议下一轮每讲一步就让学生用生活例子复述。`
        : "困惑指标偏高，建议用封闭式小问题确认全班是否跟上。",
      priority: "high",
      action: "在讲解后追加“先设什么、为什么这样设、等量关系是什么”三连确认。",
      evidenceEventIds: confusionEvidence.slice(0, 3)
    });
  }

  recommendations.push({
    title: "保留即时策略提示的追踪复盘",
    detail: strategyEvidence.length
      ? "课堂中已经出现系统调控建议，课后应逐条标记教师是否采纳。"
      : "本次系统策略证据较少，后续可主动制造一个学生突发问题训练应变。",
    priority: strategyEvidence.length ? "medium" : "low",
    action: "把每条即时建议转成下一次试讲的观察点。",
    evidenceEventIds: strategyEvidence.length ? strategyEvidence.slice(0, 3) : evidence.slice(0, 2).map((node) => node.eventId)
  });

  if (metrics.engagement < 70 || metrics.interaction < 70) {
    recommendations.push({
      title: "扩大低参与学生的可完成任务",
      detail: "互动或参与指标仍有提升空间，建议把发言任务切小，让薄弱型和内向型学生也能完成。",
      priority: "medium",
      action: "点名低参与学生只回答一步，再请积极型学生补充理由。",
      evidenceEventIds: teacherEvidence.slice(0, 3)
    });
  }

  return recommendations.map((item) => ({
    ...item,
    evidenceEventIds: item.evidenceEventIds.length ? item.evidenceEventIds : evidence.slice(0, 1).map((node) => node.eventId)
  }));
}

function createStrengths(metrics: ClassroomMetrics, overview: EvaluationReport["overview"]) {
  return [
    overview.studentQuestions > 0
      ? `学生提出 ${overview.studentQuestions} 次问题，课堂具备真实探究感。`
      : "课堂流程较可控，适合继续增加开放性提问。",
    metrics.interaction >= 70
      ? "互动指数较高，教师能够持续触发学生回应。"
      : "已经建立基本问答链路，可继续提升互动密度。",
    overview.teacherObservations > 0
      ? "教师观察指标已进入报告证据链，便于复盘讲台表现。"
      : "报告已保留教师发言和学生反馈证据，可支撑基础复盘。"
  ];
}

function createImprovements(metrics: ClassroomMetrics, recommendations: EvidenceBoundRecommendation[]) {
  const base = recommendations.map((item) => item.detail);
  if (metrics.pace < 60) {
    base.push("课堂节奏偏紧或推进不稳定，建议在关键概念后留出等待时间。");
  }
  return base.slice(0, 4);
}

function createSummary(session: TrainingSession, metrics: ClassroomMetrics, overview: EvaluationReport["overview"]) {
  return `本次“${session.courseTitle}”围绕“${session.topic}”完成微格试讲，记录 ${overview.totalEvents} 条课堂事件，其中学生问题 ${overview.studentQuestions} 次、即时建议 ${overview.systemSuggestions} 条。互动指数 ${metrics.interaction}，困惑度 ${metrics.confusion}，报告已将关键事件绑定为可追溯证据。`;
}

export function renderReportMarkdown(report: EvaluationReport) {
  const lines = [
    `# ${report.summary.includes(report.sessionId) ? "课后评价报告" : report.summary.split("”")[0].replace(/^本次“/, "") || "课后评价报告"}`,
    "",
    `生成方式：${report.generatedBy === "model" ? "大模型诊断" : "本地规则诊断"}`,
    "",
    "## 课堂概览",
    `- 事件总数：${report.overview.totalEvents}`,
    `- 教师发言：${report.overview.teacherTurns}`,
    `- 学生回应：${report.overview.studentResponses}`,
    `- 学生提问：${report.overview.studentQuestions}`,
    "",
    "## 诊断摘要",
    report.summary,
    "",
    "## 关键时间线",
    ...report.keyTimeline.map((item) => `- ${item.time} ${item.title}：${item.description}（证据：${item.evidenceEventId}）`),
    "",
    "## 学生画像响应",
    ...report.studentResponses.map((item) => `- ${item.studentName}（${item.profile}）：${item.diagnosis}`),
    "",
    "## 改进建议",
    ...report.recommendations.map((item) => `- ${item.title}：${item.action}（证据：${item.evidenceEventIds.join(", ")}）`)
  ];
  return lines.join("\n");
}

export function renderReportHtml(report: EvaluationReport) {
  const timeline = report.keyTimeline
    .map((item) => `<li><strong>${escapeHtml(item.time)} ${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span><em>证据：${escapeHtml(item.evidenceEventId)}</em></li>`)
    .join("");
  const recommendations = report.recommendations
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.action)}</span><em>证据：${escapeHtml(item.evidenceEventIds.join(", "))}</em></li>`)
    .join("");
  return [
    '<article class="exported-report">',
    `<h1>${escapeHtml(report.summary.split("”")[0].replace(/^本次“/, "") || "课后评价报告")}</h1>`,
    `<p>${escapeHtml(report.summary)}</p>`,
    "<h2>关键时间线</h2>",
    `<ol>${timeline}</ol>`,
    "<h2>改进建议</h2>",
    `<ol>${recommendations}</ol>`,
    "</article>"
  ].join("");
}

function attachExports(report: EvaluationReport): EvaluationReport {
  const withMarkdown = { ...report, exportMarkdown: "" };
  const exportMarkdown = renderReportMarkdown(withMarkdown);
  const exportHtml = renderReportHtml({ ...withMarkdown, exportMarkdown });
  return { ...report, exportMarkdown, exportHtml };
}

export function createLocalEvaluationReport({
  session,
  events,
  students,
  generatedAt = new Date().toISOString()
}: ReportInput): EvaluationReport {
  const metrics = calculateMetrics(events, students);
  const overview = buildOverview(session, events);
  const evidence = buildReportEvidence(events);
  const keyTimeline = createTimeline(evidence);
  const studentResponses = createStudentResponses(students, events);
  const teacherStrategyHits = createStrategyHits(events);
  const recommendations = createRecommendations(metrics, evidence, studentResponses);
  const strengths = createStrengths(metrics, overview);
  const improvements = createImprovements(metrics, recommendations);
  const keyMoments = keyTimeline.map((item) => `${item.time} ${item.title}：${item.description}`);
  const report: EvaluationReport = {
    id: randomUUID(),
    sessionId: session.id,
    summary: createSummary(session, metrics, overview),
    metrics,
    strengths,
    improvements,
    keyMoments: keyMoments.length ? keyMoments : ["本次试讲事件较少，建议延长试讲并增加师生互动。"],
    overview,
    evidence,
    keyTimeline,
    studentResponses,
    teacherStrategyHits,
    recommendations,
    exportMarkdown: "",
    exportHtml: "",
    generatedBy: "local",
    generatedAt
  };
  return attachExports(report);
}

function normalizeModelPatch(raw: Record<string, unknown>, recommendationCount: number): ModelReportPatch {
  const toStringArray = (value: unknown) => Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean).slice(0, 5)
    : undefined;
  const recommendationDetails = toStringArray(raw.recommendationDetails)?.slice(0, recommendationCount);
  return {
    summary: typeof raw.summary === "string" ? clip(raw.summary, 420) : undefined,
    strengths: toStringArray(raw.strengths),
    improvements: toStringArray(raw.improvements),
    recommendationDetails
  };
}

function applyModelPatch(report: EvaluationReport, patch: ModelReportPatch): EvaluationReport {
  const recommendations = report.recommendations.map((item, index) => ({
    ...item,
    detail: patch.recommendationDetails?.[index] || item.detail
  }));
  return attachExports({
    ...report,
    summary: patch.summary || report.summary,
    strengths: patch.strengths?.length ? patch.strengths : report.strengths,
    improvements: patch.improvements?.length ? patch.improvements : report.improvements,
    recommendations,
    generatedBy: "model"
  });
}

export async function generateEvaluationReport({
  provider,
  session,
  events,
  students,
  generatedAt = new Date().toISOString()
}: GenerateReportInput): Promise<{ report: EvaluationReport; usedModel: boolean; fallbackReason: string }> {
  const localReport = createLocalEvaluationReport({ session, events, students, generatedAt });
  const validation = validateProviderConfig(provider);
  if (!validation.ok) {
    return { report: { ...localReport, fallbackReason: validation.message }, usedModel: false, fallbackReason: validation.message };
  }

  try {
    const raw = await callJsonCompletion<Record<string, unknown>>(
      provider,
      [
        {
          role: "system",
          content: "你是师范生微格教学评价专家。只输出 JSON 对象，不要输出 Markdown。"
        },
        {
          role: "user",
          content: [
            "请基于规则报告和证据链改写为更专业的中文诊断，但不要编造证据。",
            "输出 JSON：{\"summary\":\"...\",\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"recommendationDetails\":[\"...\"]}",
            `课程：${session.courseTitle}`,
            `主题：${session.topic}`,
            `指标：${JSON.stringify(localReport.metrics)}`,
            `证据：${JSON.stringify(localReport.evidence.map((node) => ({ eventId: node.eventId, type: node.eventType, actor: node.actor, quote: node.quote })))}`,
            `建议标题：${JSON.stringify(localReport.recommendations.map((item) => item.title))}`
          ].join("\n")
        }
      ],
      { maxTokens: 1000, timeoutMs: 8000 }
    );
    return {
      report: applyModelPatch(localReport, normalizeModelPatch(raw, localReport.recommendations.length)),
      usedModel: true,
      fallbackReason: ""
    };
  } catch (error) {
    const fallbackReason = summarizeModelFailure(error);
    return {
      report: { ...localReport, fallbackReason },
      usedModel: false,
      fallbackReason
    };
  }
}

export function createReportEvidenceEvents(report: EvaluationReport): Array<Omit<ClassroomEvent, "id" | "timestamp">> {
  return report.evidence.map((node) => ({
    sessionId: report.sessionId,
    type: "report_evidence",
    actor: "报告证据",
    content: `${eventLabel(node.eventType)}：${node.quote}`,
    metadata: {
      reportId: report.id,
      evidenceId: node.id,
      sourceEventId: node.eventId,
      reason: node.reason,
      weight: node.weight
    }
  }));
}

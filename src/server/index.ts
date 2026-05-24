import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, store } from "./db.js";
import { callChatCompletion, callJsonCompletion, generateAiStudentTurn, streamChatCompletion, validateProviderConfig } from "./ai/provider.js";
import { createModelCallLog, sanitizeModelCallLog } from "./ai/observability.js";
import { buildProviderScenarioPrompt, type ProviderScenario } from "./ai/prompts.js";
import { buildTurnEvents, calculateMetrics, createReport } from "./domain/simulation.js";
import {
  advanceRuntimeTick,
  applyStudentMessagesToRuntime,
  buildRuntimeStateEvents,
  selectStudentsForTurn
} from "./services/studentState.js";
import { generateLessonPlan } from "./services/lessonPlanner.js";
import type {
  CreateCoursePayload,
  CreateSessionPayload,
  GenerateLessonPlanPayload,
  UpsertModelProviderPayload
} from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3001);

initDb();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function requireString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function providerConfigFromBody(body: Partial<UpsertModelProviderPayload>, current = store.getProvider()) {
  const rawApiKey = requireString(body.apiKey, current.apiKey);
  return {
    ...current,
    provider: requireString(body.provider, current.provider),
    baseURL: requireString(body.baseURL, current.baseURL),
    apiKey: rawApiKey === "********" ? current.apiKey : rawApiKey,
    model: requireString(body.model, current.model),
    temperature: Number(body.temperature ?? current.temperature),
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/dashboard", (_req, res) => {
  res.json({
    courses: store.listCourses(),
    students: store.listStudents(),
    sessions: store.listSessions(),
    reports: store.listReports(),
    lessonPlans: store.listLessonPlans()
  });
});

app.get("/api/courses", (_req, res) => {
  res.json(store.listCourses());
});

app.post("/api/courses", (req, res) => {
  const body = req.body as Partial<CreateCoursePayload>;
  const course = store.createCourse({
    title: requireString(body.title, "未命名课程"),
    subject: requireString(body.subject, "综合"),
    grade: requireString(body.grade, "未设置年级"),
    objectives: requireString(body.objectives, "训练教师完成课堂导入、提问和反馈。"),
    topic: requireString(body.topic, "微格试讲主题"),
    durationMinutes: Number(body.durationMinutes || 10)
  });
  res.status(201).json(course);
});

app.delete("/api/courses/:id", (req, res) => {
  const deleted = store.deleteCourse(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: "Course not found" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/courses/:id/lesson-plan", (req, res) => {
  const lessonPlan = store.getLessonPlan(req.params.id);
  if (!lessonPlan) {
    res.status(404).json({ message: "未找到该课程的备课脚本。" });
    return;
  }
  res.json(lessonPlan);
});

app.post("/api/lesson-plans/generate", async (req, res) => {
  const body = req.body as Partial<GenerateLessonPlanPayload>;
  const subject = requireString(body.subject);
  const grade = requireString(body.grade);
  const topic = requireString(body.topic);
  const durationMinutes = Number(body.durationMinutes || 10);

  if (!subject) {
    res.status(400).json({ message: "请填写学科。" });
    return;
  }
  if (!grade) {
    res.status(400).json({ message: "请填写年级。" });
    return;
  }
  if (!topic) {
    res.status(400).json({ message: "请填写试讲主题。" });
    return;
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 45) {
    res.status(400).json({ message: "试讲时长需在 5 到 45 分钟之间。" });
    return;
  }

  const input: GenerateLessonPlanPayload = {
    title: requireString(body.title),
    planningMode: body.planningMode === "textbook" ? "textbook" : "free-topic",
    textbookVersion: requireString(body.textbookVersion),
    volume: requireString(body.volume),
    unit: requireString(body.unit),
    lesson: requireString(body.lesson),
    period: requireString(body.period),
    subject,
    grade,
    topic,
    objectives: requireString(body.objectives, `围绕“${topic}”完成一次微格试讲训练。`),
    durationMinutes
  };

  const students = store.listStudents();
  const provider = store.getProvider();
  const startedAt = Date.now();
  const { usedModel, planDraft, fallbackReason } = await generateLessonPlan(provider, input, students);
  store.addModelCallLog(createModelCallLog({
    scenario: "lesson-plan",
    provider,
    status: usedModel ? "success" : "fallback",
    usedModel,
    fallbackReason,
    durationMs: Date.now() - startedAt,
    metadata: {
      topic,
      planningMode: input.planningMode
    }
  }));
  const course = store.createCourse({
    title: input.title || planDraft.title,
    subject,
    grade,
    topic,
    objectives: planDraft.objectives.join("；"),
    durationMinutes
  });
  const lessonPlan = store.saveLessonPlan({
    ...planDraft,
    courseId: course.id
  });
  const recommendedStudents = students.filter((student) => lessonPlan.recommendedStudentIds.includes(student.id));

  res.status(201).json({
    course,
    lessonPlan,
    recommendedStudents,
    usedModel,
    fallbackReason: fallbackReason ?? ""
  });
});

app.get("/api/model-calls", (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  res.json(store.listModelCallLogs(limit).map(sanitizeModelCallLog));
});

app.get("/api/students", (_req, res) => {
  res.json(store.listStudents());
});

app.post("/api/students", (req, res) => {
  const body = req.body ?? {};
  const student = store.upsertStudent({
    id: typeof body.id === "string" ? body.id : undefined,
    name: requireString(body.name, "新学生"),
    avatar: requireString(body.avatar, "自定义"),
    personality: requireString(body.personality, "课堂表现待观察。"),
    foundation: Number(body.foundation || 60),
    attention: Number(body.attention || 60),
    comprehension: Number(body.comprehension || 60),
    participation: Number(body.participation || 60),
    behaviorStyle: requireString(body.behaviorStyle, "根据课堂情境自然回应。"),
    status: requireString(body.status, "观察"),
    strategy: requireString(body.strategy, "用明确任务引导参与。")
  });
  res.status(201).json(student);
});

app.get("/api/sessions", (_req, res) => {
  res.json(store.listSessions());
});

app.get("/api/sessions/:id", (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  const students = store.listStudents().filter((student) => session.selectedStudentIds.includes(student.id));
  res.json({
    session,
    events: store.listEvents(session.id),
    runtimeStates: store.ensureRuntimeStates(session.id, students),
    report: store.getReport(session.id)
  });
});

app.post("/api/sessions", (req, res) => {
  const body = req.body as Partial<CreateSessionPayload>;
  const course = store.listCourses().find((item) => item.id === body.courseId) ?? store.listCourses()[0];
  if (!course) {
    res.status(400).json({ message: "请先创建课程。" });
    return;
  }
  const students = store.listStudents();
  const selectedStudentIds = Array.isArray(body.selectedStudentIds) && body.selectedStudentIds.length
    ? body.selectedStudentIds
    : students.slice(0, 6).map((student) => student.id);
  res.status(201).json(store.createSession(course, selectedStudentIds));
});

app.delete("/api/sessions/:id", (req, res) => {
  const deleted = store.deleteSession(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/sessions/:id/start", (req, res) => {
  const session = store.updateSessionStatus(req.params.id, "active");
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  res.json(session);
});

app.post("/api/sessions/:id/turn", async (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  const teacherText = requireString(req.body?.teacherText);
  if (!teacherText) {
    res.status(400).json({ message: "教师发言不能为空。" });
    return;
  }

  const activeSession = session.status === "active" ? session : store.updateSessionStatus(session.id, "active") ?? session;
  const teacherEvent = store.addEvent({
    sessionId: activeSession.id,
    type: "teacher_utterance",
    actor: "教师",
    content: teacherText,
    metadata: {
      input: req.body?.inputMode === "speech" ? "speech" : "manual"
    }
  });

  const allStudents = store.listStudents();
  const selectedStudents = allStudents.filter((student) => activeSession.selectedStudentIds.includes(student.id));
  const runtimeStudents = selectedStudents.length ? selectedStudents : allStudents.slice(0, 6);
  const runtimeStates = store.ensureRuntimeStates(activeSession.id, runtimeStudents);
  const respondingStudents = selectStudentsForTurn(runtimeStudents, runtimeStates, teacherText, Math.min(4, runtimeStudents.length));
  const recentEvents = store.listEvents(activeSession.id).slice(-8);
  const provider = store.getProvider();
  const startedAt = Date.now();
  const aiTurn = await generateAiStudentTurn(provider, {
    session: activeSession,
    students: respondingStudents,
    teacherText,
    runtimeStates,
    recentEvents
  });
  store.addModelCallLog(createModelCallLog({
    scenario: "student-turn",
    provider,
    status: aiTurn.usedModel ? "success" : "fallback",
    usedModel: aiTurn.usedModel,
    fallbackReason: aiTurn.fallbackReason,
    durationMs: Date.now() - startedAt,
    metadata: {
      sessionId: activeSession.id,
      teacherEventId: teacherEvent.id,
      respondingStudentIds: respondingStudents.map((student) => student.id)
    }
  }));

  const updatedRuntimeStates = applyStudentMessagesToRuntime(runtimeStates, aiTurn.result.messages);
  updatedRuntimeStates.forEach((state) => store.upsertRuntimeState(state));
  const stateEvents = buildRuntimeStateEvents(runtimeStates, updatedRuntimeStates, runtimeStudents).map((event) => store.addEvent(event));
  const savedEvents = buildTurnEvents(activeSession.id, aiTurn.result, aiTurn.usedModel, updatedRuntimeStates, aiTurn.fallbackReason).map((event) => store.addEvent(event));
  const allEvents = store.listEvents(activeSession.id);
  const metrics = calculateMetrics(allEvents, runtimeStudents);
  const metricEvent = store.addEvent({
    sessionId: activeSession.id,
    type: "classroom_metric",
    actor: "课堂脉搏",
    content: `注意力 ${metrics.attention}，困惑度 ${metrics.confusion}，互动度 ${metrics.interaction}`,
    metadata: { ...metrics }
  });

  res.json({
    teacherEvent,
    responses: savedEvents,
    stateEvents,
    metricEvent,
    metrics,
    runtimeStates: updatedRuntimeStates,
    usedModel: aiTurn.usedModel,
    fallbackReason: aiTurn.fallbackReason ?? ""
  });
});

app.post("/api/sessions/:id/tick", (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  const students = store.listStudents().filter((student) => session.selectedStudentIds.includes(student.id));
  const runtimeStates = store.ensureRuntimeStates(session.id, students);
  const tick = advanceRuntimeTick(runtimeStates, students);
  tick.states.forEach((state) => store.upsertRuntimeState(state));
  const stateEvents = tick.events.map((event) => store.addEvent(event));
  res.json({
    stateEvents,
    runtimeStates: tick.states
  });
});

app.post("/api/sessions/:id/complete", (req, res) => {
  const session = store.updateSessionStatus(req.params.id, "completed");
  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return;
  }
  const students = store.listStudents().filter((student) => session.selectedStudentIds.includes(student.id));
  const events = store.listEvents(session.id);
  const report = store.saveReport(createReport(session, events, students));
  res.json({ session, report });
});

app.get("/api/model-provider", (_req, res) => {
  const provider = store.getProvider();
  res.json({ ...provider, apiKey: provider.apiKey ? "********" : "" });
});

app.post("/api/model-provider", (req, res) => {
  const body = req.body as Partial<UpsertModelProviderPayload>;
  const current = store.getProvider();
  const rawApiKey = requireString(body.apiKey, current.apiKey);
  const apiKey = rawApiKey === "********" ? current.apiKey : rawApiKey;
  const config = store.saveProvider({
    provider: requireString(body.provider, current.provider),
    baseURL: requireString(body.baseURL, current.baseURL),
    apiKey,
    model: requireString(body.model, current.model),
    temperature: Number(body.temperature ?? current.temperature),
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled
  });
  res.json({ ...config, apiKey: config.apiKey ? "********" : "" });
});

app.post("/api/model-provider/test", async (req, res) => {
  const body = req.body as Partial<UpsertModelProviderPayload>;
  const config = providerConfigFromBody(body);
  const validation = validateProviderConfig(config);
  const startedAt = Date.now();
  if (!validation.ok) {
    store.addModelCallLog(createModelCallLog({
      scenario: "provider-test",
      provider: config,
      status: "error",
      usedModel: false,
      fallbackReason: validation.message,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "connection" }
    }));
    res.json({ ok: false, message: validation.message });
    return;
  }
  try {
    const reply = await callChatCompletion(
      config,
      [
        { role: "system", content: "你是模型连接测试助手，只用中文简短回复。" },
        { role: "user", content: "请回复：模型连接正常。" }
      ],
      { maxTokens: 24, timeoutMs: 20000 }
    );
    store.addModelCallLog(createModelCallLog({
      scenario: "provider-test",
      provider: config,
      status: "success",
      usedModel: true,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "connection" }
    }));
    res.json({ ok: true, message: reply || "模型连接正常。" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型连接测试失败。";
    store.addModelCallLog(createModelCallLog({
      scenario: "provider-test",
      provider: config,
      status: "error",
      usedModel: false,
      fallbackReason: message,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "connection" }
    }));
    res.json({ ok: false, message });
  }
});

app.post("/api/model-provider/scenario-test", async (req, res) => {
  const scenario = requireString(req.body?.scenario) as ProviderScenario;
  if (!["student-turn", "lesson-plan", "report"].includes(scenario)) {
    res.status(400).json({ ok: false, message: "未知模型测试场景。" });
    return;
  }

  const config = providerConfigFromBody(req.body as Partial<UpsertModelProviderPayload>);
  const validation = validateProviderConfig(config);
  const startedAt = Date.now();
  if (!validation.ok) {
    store.addModelCallLog(createModelCallLog({
      scenario,
      provider: config,
      status: "error",
      usedModel: false,
      fallbackReason: validation.message,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "scenario" }
    }));
    res.json({ ok: false, message: validation.message });
    return;
  }

  try {
    const prompt = buildProviderScenarioPrompt(scenario);
    const sample = await callJsonCompletion<Record<string, unknown>>(config, prompt.messages, {
      maxTokens: prompt.maxTokens,
      timeoutMs: scenario === "lesson-plan" ? 45000 : 30000
    });
    store.addModelCallLog(createModelCallLog({
      scenario,
      provider: config,
      status: "success",
      usedModel: true,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "scenario" }
    }));
    res.json({ ok: true, message: prompt.successMessage, sample });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型场景测试失败。";
    store.addModelCallLog(createModelCallLog({
      scenario,
      provider: config,
      status: "error",
      usedModel: false,
      fallbackReason: message,
      durationMs: Date.now() - startedAt,
      metadata: { testType: "scenario" }
    }));
    res.json({ ok: false, message });
  }
});

app.post("/api/model-provider/stream-test", async (req, res) => {
  const config = store.getProvider();
  const validation = validateProviderConfig(config);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (!validation.ok) {
    res.write(`data: ${JSON.stringify({ token: validation.message })}\n\n`);
    res.write("event: done\ndata: {}\n\n");
    res.end();
    return;
  }
  try {
    await streamChatCompletion(
      config,
      [
        { role: "system", content: "你是模型流式输出测试助手。" },
        { role: "user", content: "请用一句中文说明流式输出正常。" }
      ],
      (token) => res.write(`data: ${JSON.stringify({ token })}\n\n`)
    );
    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ token: error instanceof Error ? error.message : "流式测试失败。" })}\n\n`);
    res.write("event: done\ndata: {}\n\n");
    res.end();
  }
});

const builtClientDir = path.resolve(process.cwd(), "dist/client");
const clientDir = existsSync(path.join(builtClientDir, "index.html"))
  ? builtClientDir
  : path.resolve(__dirname, "../client");
app.use(express.static(clientDir));
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ message: "API not found" });
    return;
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

app.listen(port, () => {
  console.log(`AI数字学生课堂微格实训平台后端已启动：http://localhost:${port}`);
});

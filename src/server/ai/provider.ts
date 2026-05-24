import type {
  ClassroomEvent,
  ModelProviderConfig,
  StudentAgent,
  StudentRuntimeState,
  TrainingSession
} from "../../shared/types.js";
import { parseJsonObject } from "./json.js";
import { summarizeModelFailure } from "./observability.js";
import { buildStudentTurnPrompt } from "./prompts.js";

export interface GenerateStudentContext {
  session: TrainingSession;
  students: StudentAgent[];
  teacherText: string;
  runtimeStates?: StudentRuntimeState[];
  recentEvents?: ClassroomEvent[];
}

export interface AiStudentMessage {
  studentId: string;
  studentName: string;
  content: string;
  mood: string;
}

export interface AiSuggestionResult {
  suggestion: string;
  messages: AiStudentMessage[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
  timeoutMs?: number;
  extraBody?: Record<string, unknown>;
}

function cleanBaseUrl(baseURL: string) {
  return baseURL.replace(/\/$/, "");
}

function chatCompletionUrl(config: ModelProviderConfig) {
  const baseURL = cleanBaseUrl(config.baseURL);
  return /\/chat\/completions$/i.test(baseURL) ? baseURL : `${baseURL}/chat/completions`;
}

function isDeepSeekProvider(config: ModelProviderConfig) {
  return /deepseek/i.test(config.provider) || /deepseek/i.test(config.baseURL) || /^deepseek-/i.test(config.model);
}

export function validateProviderConfig(config: ModelProviderConfig) {
  if (!config.enabled) {
    return { ok: false, message: "当前未启用真实大模型生成，系统会使用本地模拟引擎。" };
  }
  if (!config.apiKey || config.apiKey === "********") {
    return { ok: false, message: "请先填写 API Key；未配置时系统会使用本地模拟引擎。" };
  }
  if (!config.baseURL) {
    return { ok: false, message: "请填写 OpenAI-compatible Base URL。" };
  }
  if (!config.model) {
    return { ok: false, message: "请填写模型名称。" };
  }
  return { ok: true, message: "模型配置字段完整。" };
}

export function buildChatCompletionPayload(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const payload: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature,
    messages
  };

  if (typeof options.maxTokens === "number") {
    payload.max_tokens = options.maxTokens;
  }
  if (options.json) {
    payload.response_format = { type: "json_object" };
  }
  if (isDeepSeekProvider(config)) {
    payload.thinking = { type: "disabled" };
  }
  if (options.stream) {
    payload.stream = true;
  }
  if (options.extraBody) {
    Object.assign(payload, options.extraBody);
  }

  return payload;
}

async function readProviderError(response: Response) {
  const body = await response.text().catch(() => "");
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? body.slice(0, 240);
  } catch {
    return body.slice(0, 240);
  }
}

function createTimeoutController(timeoutMs = 45000) {
  const safeTimeoutMs = Math.max(1, Math.min(120000, Math.round(timeoutMs)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeoutMs);
  return {
    signal: controller.signal,
    timeoutMs: safeTimeoutMs,
    cancel: () => clearTimeout(timer)
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted|abort/i.test(error.message));
}

function describeProviderError(status: number, detail: string) {
  const suffix = detail ? `（${detail}）` : "";
  if (status === 401 || status === 403) return `模型接口鉴权失败，请检查 API Key。${suffix}`;
  if (status === 402) return `模型账户余额或额度不足。${suffix}`;
  if (status === 404) return `模型接口地址或模型名称不可用，请检查 Base URL 和模型名。${suffix}`;
  if (status === 429) return `模型接口请求过于频繁，请稍后重试。${suffix}`;
  if (status >= 500) return `模型服务暂时不可用，请稍后重试。${suffix}`;
  return `模型接口返回 ${status}。${suffix}`;
}

async function postChatCompletion(config: ModelProviderConfig, payload: Record<string, unknown>, timeoutMs?: number) {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  let response: Response;
  const timeout = createTimeoutController(timeoutMs);
  try {
    response = await fetch(chatCompletionUrl(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: timeout.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`模型接口请求超时（${timeout.timeoutMs}ms），请检查网络、代理或 Base URL。`);
    }
    throw error;
  } finally {
    timeout.cancel();
  }

  if (!response.ok) {
    throw new Error(describeProviderError(response.status, await readProviderError(response)));
  }

  return response;
}

export async function callChatCompletion(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const response = await postChatCompletion(config, buildChatCompletionPayload(config, messages, options), options.timeoutMs);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (options.json && !content.trim()) {
    throw new Error("模型返回空内容，请重试。");
  }
  return content;
}

export async function callJsonCompletion<T extends Record<string, unknown>>(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  options: Omit<ChatCompletionOptions, "json" | "stream"> = {}
): Promise<T> {
  const content = await callChatCompletion(config, messages, { ...options, json: true });
  return parseJsonObject(content) as T;
}

export async function streamChatCompletion(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  onToken: (token: string) => void
) {
  const response = await postChatCompletion(config, buildChatCompletionPayload(config, messages, { stream: true }));
  if (!response.body) {
    throw new Error("模型流式接口没有返回可读取的数据。");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.replace(/^data:\s*/, "");
      if (data === "[DONE]") return;
      try {
        const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const token = payload.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {
        continue;
      }
    }
  }
}

function runtimeForStudent(context: GenerateStudentContext, studentId: string) {
  return context.runtimeStates?.find((state) => state.studentId === studentId);
}

function latestMemoryForStudent(context: GenerateStudentContext, studentId: string) {
  const state = runtimeForStudent(context, studentId);
  return state?.memory[state.memory.length - 1] ?? "";
}

function summarizeMemory(memory: string) {
  const clipped = memory.replace(/[。！？!?].*$/, "").slice(0, 42);
  return clipped || "刚才那一步";
}

function inferLessonAnchor(teacherText: string) {
  if (/限定词|几乎|大约|左右|可能|之一|主要|绝大多数/.test(teacherText)) {
    return "限定词和它对表达准确性的作用";
  }
  if (/关键词|第一步|看哪里|划出|找/.test(teacherText)) {
    return "关键词和第一步判断依据";
  }
  if (/直角|斜边|勾股|三角形/.test(teacherText)) {
    return "直角边、斜边和三边关系";
  }
  const cleaned = teacherText
    .replace(/[\s，。！？!?、；;：:]+/g, " ")
    .replace(/^[^，。！？!?]*?(同学们|你来|谁能|请|说说)/, "")
    .trim();
  return cleaned.slice(0, 18) || "这个关键步骤";
}

function fallbackMessage(student: StudentAgent, context: GenerateStudentContext, index: number): AiStudentMessage {
  const { teacherText } = context;
  const text = teacherText.toLowerCase();
  const hasQuestion = /吗|什么|为什么|怎么|如何|\?|？/.test(teacherText);
  const runtime = runtimeForStudent(context, student.id);
  const memory = latestMemoryForStudent(context, student.id);
  const lessonAnchor = inferLessonAnchor(teacherText);
  const runtimeText = `${runtime?.pose ?? ""} ${runtime?.statusText ?? ""} ${runtime?.emotion ?? ""} ${memory}`;
  const namedByTeacher = teacherText.includes(student.name);

  if (/质疑|挑战|边界|例外|反问/.test(`${student.status} ${student.personality} ${runtimeText}`)) {
    return {
      studentId: student.id,
      studentName: student.name,
      content: "老师，如果条件换一下或者限定词放到别的句子里，是不是就不能直接下结论？",
      mood: runtime?.statusText || student.status || "边界追问"
    };
  }

  if (/走神|漏听|低头|distracted/.test(`${student.status} ${student.behaviorStyle} ${runtimeText}`)) {
    const anchor = memory ? summarizeMemory(memory) : lessonAnchor;
    return {
      studentId: student.id,
      studentName: student.name,
      content: namedByTeacher
        ? `老师，我刚才漏听了一点，记得第一步是${anchor}，我这样说对吗？`
        : `老师，我刚才有点走神，想确认现在是不是还在讲${anchor || "这个关键步骤"}？`,
      mood: runtime?.statusText || "回到课堂"
    };
  }

  if (/困惑|不懂|跟不上|不会|听不懂|confused/.test(`${student.status} ${student.behaviorStyle} ${runtimeText}`)) {
    const anchor = memory ? summarizeMemory(memory) : lessonAnchor;
    return {
      studentId: student.id,
      studentName: student.name,
      content: `老师，我能跟到${anchor}，但后面为什么这样判断还不太明白。`,
      mood: runtime?.statusText || "有点困惑"
    };
  }

  if (/投入|积极|举手|主动|抢答|smiling/.test(`${student.status} ${student.personality} ${student.behaviorStyle} ${runtimeText}`)) {
    const anchor = memory ? summarizeMemory(memory) : lessonAnchor;
    return {
      studentId: student.id,
      studentName: student.name,
      content: `我觉得可以先抓住${anchor}，再补充说明它对表达准确性的影响。`,
      mood: runtime?.statusText || "积极回应"
    };
  }

  const templates = [
    "老师，我有点跟不上，能不能把刚才这一步再拆开说一下？",
    "我觉得可以先找直角边，再看斜边是不是最长的那一条。",
    "如果题目换成生活里的楼梯或者操场距离，也能这样算吗？",
    `我想确认一下现在是不是先看 ${teacherText.slice(0, 18) || "这个知识点"}。`,
    "这个结论我能记住，但不知道什么时候该用。"
  ];
  const challenge = "老师，如果条件不完整，是不是就不能直接套公式？";
  const content =
    student.status.includes("质疑") || student.personality.includes("挑战")
      ? challenge
      : hasQuestion
        ? templates[(index + 1) % templates.length]
        : templates[index % templates.length];
  return {
    studentId: student.id,
    studentName: student.name,
    content: text.length > 1 ? content : "老师，我准备好了，可以开始。",
    mood: runtime?.statusText || student.status
  };
}

function fallbackSuggestion(messages: AiStudentMessage[], context?: GenerateStudentContext) {
  const confused = messages.filter((message) => /跟不上|不知道|确认|不能|不懂/.test(message.content));
  const driftingStudents = context?.students.filter((student) => {
    const runtime = runtimeForStudent(context, student.id);
    return runtime?.pose === "distracted" || /走神|漏听/.test(runtime?.statusText ?? student.status);
  }) ?? [];
  if (confused.length > 1) {
    return "当前有多名学生出现理解阻滞，建议暂停推进，换一个生活化例子，并用一个封闭式小问题确认全班是否跟上。";
  }
  if (driftingStudents.length) {
    return `注意 ${driftingStudents.map((student) => student.name).join("、")} 出现走神或漏听信号，建议用点名复述和一步确认把注意力拉回课堂。`;
  }
  if (messages.some((message) => /如果|是不是/.test(message.content))) {
    return "学生开始提出边界问题，可以先肯定问题价值，再把追问转成全班判断任务，避免课堂被单个问题带偏。";
  }
  return "课堂互动状态稳定。建议继续保持短讲解加短提问的节奏，并邀请低参与学生复述关键步骤。";
}

function normalizeStudentTurnResult(raw: Record<string, unknown>, students: StudentAgent[]): AiSuggestionResult {
  const allowedIds = new Set(students.map((student) => student.id));
  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const messages = rawMessages
    .filter((message): message is Record<string, unknown> => Boolean(message) && typeof message === "object")
    .filter((message) => allowedIds.has(String(message.studentId)))
    .slice(0, 4)
    .map((message) => ({
      studentId: String(message.studentId),
      studentName: String(message.studentName || "AI学生"),
      content: String(message.content || "").slice(0, 160),
      mood: String(message.mood || "回应")
    }))
    .filter((message) => message.content);

  const suggestion = typeof raw.suggestion === "string" ? raw.suggestion.slice(0, 220) : "";
  if (!suggestion || messages.length === 0) {
    throw new Error("模型 JSON 缺少可用的学生回应或教学建议。");
  }

  return { messages, suggestion };
}

export async function generateAiStudentTurn(
  config: ModelProviderConfig,
  context: GenerateStudentContext
): Promise<{ usedModel: boolean; result: AiSuggestionResult; fallbackReason?: string }> {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    const messages = context.students.slice(0, 3).map((student, index) => fallbackMessage(student, context, index));
    return {
      usedModel: false,
      fallbackReason: validation.message,
      result: {
        messages,
        suggestion: fallbackSuggestion(messages, context)
      }
    };
  }

  try {
    const prompt = buildStudentTurnPrompt(context);
    const raw = await callJsonCompletion<Record<string, unknown>>(config, prompt.messages, {
      maxTokens: prompt.maxTokens,
      timeoutMs: 30000
    });
    return {
      usedModel: true,
      result: normalizeStudentTurnResult(raw, context.students)
    };
  } catch (error) {
    const fallbackReason = summarizeModelFailure(error);
    const messages = context.students.slice(0, 3).map((student, index) => fallbackMessage(student, context, index));
    return {
      usedModel: false,
      fallbackReason,
      result: {
        messages,
        suggestion: `${fallbackSuggestion(messages, context)} ${fallbackReason}`
      }
    };
  }
}

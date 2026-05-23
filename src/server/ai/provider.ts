import type { ModelProviderConfig, StudentAgent, TrainingSession } from "../../shared/types.js";
import { parseJsonObject } from "./json.js";
import { buildStudentTurnPrompt } from "./prompts.js";

export interface GenerateStudentContext {
  session: TrainingSession;
  students: StudentAgent[];
  teacherText: string;
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
  extraBody?: Record<string, unknown>;
}

function cleanBaseUrl(baseURL: string) {
  return baseURL.replace(/\/$/, "");
}

function chatCompletionUrl(config: ModelProviderConfig) {
  return `${cleanBaseUrl(config.baseURL)}/chat/completions`;
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

function describeProviderError(status: number, detail: string) {
  const suffix = detail ? `（${detail}）` : "";
  if (status === 401 || status === 403) return `模型接口鉴权失败，请检查 API Key。${suffix}`;
  if (status === 402) return `模型账户余额或额度不足。${suffix}`;
  if (status === 404) return `模型接口地址或模型名称不可用，请检查 Base URL 和模型名。${suffix}`;
  if (status === 429) return `模型接口请求过于频繁，请稍后重试。${suffix}`;
  if (status >= 500) return `模型服务暂时不可用，请稍后重试。${suffix}`;
  return `模型接口返回 ${status}。${suffix}`;
}

async function postChatCompletion(config: ModelProviderConfig, payload: Record<string, unknown>) {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const response = await fetch(chatCompletionUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(payload)
  });

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
  const response = await postChatCompletion(config, buildChatCompletionPayload(config, messages, options));
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

function fallbackMessage(student: StudentAgent, teacherText: string, index: number): AiStudentMessage {
  const text = teacherText.toLowerCase();
  const hasQuestion = /吗|什么|为什么|怎么|如何|\?|？/.test(teacherText);
  const templates = [
    "老师，我有点跟不上，能不能把刚才这一步再拆开说一下？",
    "我觉得可以先找直角边，再看斜边是不是最长的那一条。",
    "如果题目换成生活里的楼梯或者操场距离，也能这样算吗？",
    `我刚才走神了，想确认一下现在是在用 ${teacherText.slice(0, 18) || "这个知识点"} 吗？`,
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
    mood: student.status
  };
}

function fallbackSuggestion(messages: AiStudentMessage[]) {
  const confused = messages.filter((message) => /跟不上|不知道|确认|不能|不懂/.test(message.content));
  if (confused.length > 1) {
    return "当前有多名学生出现理解阻滞，建议暂停推进，换一个生活化例子，并用一个封闭式小问题确认全班是否跟上。";
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
): Promise<{ usedModel: boolean; result: AiSuggestionResult }> {
  if (!config.enabled || !config.apiKey || !config.baseURL || !config.model) {
    const messages = context.students.slice(0, 3).map((student, index) => fallbackMessage(student, context.teacherText, index));
    return {
      usedModel: false,
      result: {
        messages,
        suggestion: fallbackSuggestion(messages)
      }
    };
  }

  try {
    const prompt = buildStudentTurnPrompt(context);
    const raw = await callJsonCompletion<Record<string, unknown>>(config, prompt.messages, { maxTokens: prompt.maxTokens });
    return {
      usedModel: true,
      result: normalizeStudentTurnResult(raw, context.students)
    };
  } catch {
    const messages = context.students.slice(0, 3).map((student, index) => fallbackMessage(student, context.teacherText, index));
    return {
      usedModel: false,
      result: {
        messages,
        suggestion: `${fallbackSuggestion(messages)} 当前模型调用不可用，系统已切换为本地模拟回应。`
      }
    };
  }
}

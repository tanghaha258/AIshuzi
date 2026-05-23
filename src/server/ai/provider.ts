import type { ModelProviderConfig, StudentAgent, TrainingSession } from "../../shared/types.js";

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

function cleanBaseUrl(baseURL: string) {
  return baseURL.replace(/\/$/, "");
}

export function validateProviderConfig(config: ModelProviderConfig) {
  if (!config.enabled) {
    return { ok: false, message: "当前未启用真实大模型生成，系统会使用本地模拟引擎。" };
  }
  if (!config.apiKey) {
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

export async function callChatCompletion(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  options: { maxTokens?: number } = {}
) {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const response = await fetch(`${cleanBaseUrl(config.baseURL)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: options.maxTokens,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`模型接口返回 ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

export async function streamChatCompletion(
  config: ModelProviderConfig,
  messages: ChatMessage[],
  onToken: (token: string) => void
) {
  const validation = validateProviderConfig(config);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const response = await fetch(`${cleanBaseUrl(config.baseURL)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      stream: true,
      messages
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`模型流式接口返回 ${response.status}`);
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
    `老师，我有点跟不上，能不能把刚才这一步再拆开说一下？`,
    `我觉得可以先找直角边，再看斜边是不是最大的一条。`,
    `如果题目换成生活里的楼梯或者操场距离，也能这样算吗？`,
    `我刚刚走神了，想确认一下现在是在用 ${teacherText.slice(0, 18) || "这个知识点"} 吗？`,
    `这个结论我能记住，但不知道什么时候该用。`
  ];
  const challenge = `老师，如果条件不完整，是不是就不能直接套公式？`;
  const content =
    student.status.includes("质疑") || student.personality.includes("挑战")
      ? challenge
      : hasQuestion
        ? templates[(index + 1) % templates.length]
        : templates[index % templates.length];
  return {
    studentId: student.id,
    studentName: student.name,
    content: text.length > 1 ? content : `老师，我准备好了，可以开始。`,
    mood: student.status
  };
}

function fallbackSuggestion(messages: AiStudentMessage[]) {
  const confused = messages.filter((message) => /跟不上|不知道|确认|不能/.test(message.content));
  if (confused.length > 1) {
    return "当前有多名学生出现理解阻滞，建议暂停推进，换一个生活化例子，并用一个封闭式小问题确认全班是否跟上。";
  }
  if (messages.some((message) => /如果|是不是/.test(message.content))) {
    return "学生开始提出边界问题，可以先肯定问题价值，再把追问转成全班判断任务，避免课堂被单个问题带偏。";
  }
  return "课堂互动状态稳定。建议继续保持短讲解加短提问的节奏，并邀请低参与学生复述关键步骤。";
}

function parseJsonPayload(raw: string): AiSuggestionResult | undefined {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]) as AiSuggestionResult;
    if (Array.isArray(parsed.messages) && typeof parsed.suggestion === "string") {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
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

  const prompt = [
    "你是一个师范生微格教学实训平台里的课堂模拟引擎。",
    "请基于教师发言和学生画像，生成 2-4 个AI学生的真实课堂反应，并给教师一条即时教学策略建议。",
    "必须只输出 JSON，格式：",
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
    )}`
  ].join("\n");

  try {
    const content = await callChatCompletion(config, [
      {
        role: "system",
        content: "你擅长模拟不同性格和基础水平的中小学生课堂表现。输出必须是可解析 JSON。"
      },
      { role: "user", content: prompt }
    ]);
    const parsed = parseJsonPayload(content);
    if (!parsed) {
      throw new Error("Model response is not valid JSON.");
    }
    const allowedIds = new Set(context.students.map((student) => student.id));
    const messages = parsed.messages
      .filter((message) => allowedIds.has(message.studentId))
      .slice(0, 4)
      .map((message) => ({
        ...message,
        content: message.content.slice(0, 160),
        mood: message.mood || "回应"
      }));

    if (messages.length === 0) {
      throw new Error("Model returned no usable student messages.");
    }

    return {
      usedModel: true,
      result: {
        messages,
        suggestion: parsed.suggestion.slice(0, 220)
      }
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

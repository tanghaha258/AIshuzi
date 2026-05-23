export class JsonOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonOutputError";
  }
}

function extractJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return raw.slice(start, end + 1);
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const candidate = extractJsonObject(raw);
  if (!candidate) {
    throw new JsonOutputError("没有找到可解析的 JSON。");
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new JsonOutputError("模型输出不是 JSON 对象。");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof JsonOutputError) throw error;
    throw new JsonOutputError("模型输出不是合法 JSON。");
  }
}

export function safeParseJsonObject(raw: string) {
  try {
    return parseJsonObject(raw);
  } catch {
    return undefined;
  }
}

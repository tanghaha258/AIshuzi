import { randomUUID } from "node:crypto";
import type { ModelCallLog, ModelCallScenario, ModelCallStatus, ModelProviderConfig } from "../../shared/types.js";

interface CreateModelCallLogInput {
  scenario: ModelCallScenario;
  provider?: Pick<ModelProviderConfig, "provider" | "model" | "baseURL">;
  status: ModelCallStatus;
  usedModel: boolean;
  fallbackReason?: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

const secretKeyPattern = /(api[-_]?key|authorization|token|secret|password)/i;

function cleanMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanMetadata);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !secretKeyPattern.test(key))
      .map(([key, nested]) => [key, cleanMetadata(nested)])
  );
}

export function createModelCallLog(input: CreateModelCallLogInput): ModelCallLog {
  return sanitizeModelCallLog({
    id: randomUUID(),
    scenario: input.scenario,
    provider: input.provider?.provider ?? "未配置",
    model: input.provider?.model ?? "",
    baseURL: input.provider?.baseURL ?? "",
    status: input.status,
    usedModel: input.usedModel,
    fallbackReason: input.fallbackReason ?? "",
    durationMs: Math.max(0, Math.round(input.durationMs)),
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  });
}

export function sanitizeModelCallLog<T extends ModelCallLog>(log: T): T {
  return {
    ...log,
    metadata: cleanMetadata(log.metadata ?? {}) as Record<string, unknown>
  };
}

export function summarizeModelFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/401|403|unauthorized|forbidden|invalid api key|bad key|鉴权/i.test(message)) {
    return "模型接口鉴权失败，请检查 API Key。";
  }
  if (/429|rate limit|too many/i.test(message)) {
    return "模型接口请求过于频繁，请稍后重试。";
  }
  if (/402|quota|balance|insufficient/i.test(message)) {
    return "模型账户余额或额度不足，请检查 DeepSeek 后台。";
  }
  if (/404|not found|model/i.test(message)) {
    return "模型接口地址或模型名称不可用，请检查 Base URL 和模型名。";
  }
  if (/json|parse|unexpected end|格式|缺少/i.test(message)) {
    return "模型返回 JSON 格式不完整，已切换为本地模拟。";
  }
  if (/network|fetch|timeout|econn/i.test(message)) {
    return "模型网络连接失败，请检查网络或代理。";
  }
  return message ? `模型调用失败：${message.slice(0, 120)}` : "模型调用失败，已切换为本地模拟。";
}

import type { ModelProviderConfig } from "./types.js";

export const deepSeekRecommendedModels = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;

export function createDeepSeekDefaultProvider(): ModelProviderConfig {
  return {
    id: "deepseek-default",
    provider: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    apiKey: "",
    model: "deepseek-v4-flash",
    temperature: 0.7,
    enabled: false,
    updatedAt: new Date(0).toISOString()
  };
}

export function isLegacyOpenAiDefaultProvider(
  config: Pick<ModelProviderConfig, "provider" | "baseURL" | "apiKey" | "model" | "temperature" | "enabled">
) {
  return (
    config.provider === "OpenAI Compatible" &&
    config.baseURL === "https://api.openai.com/v1" &&
    config.apiKey === "" &&
    config.model === "gpt-4o-mini" &&
    Number(config.temperature) === 0.7 &&
    !config.enabled
  );
}

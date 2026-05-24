import assert from "node:assert/strict";
import {
  createModelCallLog,
  sanitizeModelCallLog,
  summarizeModelFailure
} from "../src/server/ai/observability.js";
import type { ModelProviderConfig } from "../src/shared/types.js";

const provider: ModelProviderConfig = {
  id: "provider-1",
  provider: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  apiKey: "sk-secret-should-never-leak",
  model: "deepseek-v4-flash",
  temperature: 0.7,
  enabled: true,
  updatedAt: "2026-05-24T10:00:00.000Z"
};

const successLog = createModelCallLog({
  scenario: "lesson-plan",
  provider,
  status: "success",
  usedModel: true,
  durationMs: 846,
  fallbackReason: ""
});

assert.equal(successLog.scenario, "lesson-plan");
assert.equal(successLog.provider, "DeepSeek");
assert.equal(successLog.model, "deepseek-v4-flash");
assert.equal(successLog.baseURL, "https://api.deepseek.com");
assert.equal(successLog.status, "success");
assert.equal(successLog.usedModel, true);
assert.equal(successLog.durationMs, 846);
assert.equal(successLog.fallbackReason, "");
assert.ok(successLog.createdAt);

const failedLog = createModelCallLog({
  scenario: "student-turn",
  provider,
  status: "fallback",
  usedModel: false,
  durationMs: 21,
  fallbackReason: "模型接口鉴权失败，请检查 API Key。"
});

const sanitized = sanitizeModelCallLog({
  ...failedLog,
  metadata: {
    Authorization: "Bearer sk-secret-should-never-leak",
    apiKey: "sk-secret-should-never-leak",
    safe: "kept"
  }
});

assert.equal(JSON.stringify(sanitized).includes("sk-secret"), false);
assert.equal(JSON.stringify(sanitized).includes("Authorization"), false);
assert.equal(sanitized.metadata?.safe, "kept");
assert.match(summarizeModelFailure(new Error("401 bad key")), /鉴权|API Key/);
assert.match(summarizeModelFailure(new Error("Unexpected end of JSON input")), /JSON|格式/);

console.log("AI observability contract passed.");

import assert from "node:assert/strict";
import { createDeepSeekDefaults } from "../src/server/ai/deepseek.js";
import { parseJsonObject } from "../src/server/ai/json.js";
import { buildChatCompletionPayload, callChatCompletion, validateProviderConfig } from "../src/server/ai/provider.js";
import type { ModelProviderConfig } from "../src/shared/types.js";

const defaults = createDeepSeekDefaults();
assert.equal(defaults.provider, "DeepSeek");
assert.equal(defaults.baseURL, "https://api.deepseek.com");
assert.equal(defaults.model, "deepseek-v4-flash");
assert.equal(defaults.temperature, 0.7);
assert.equal(defaults.enabled, false);

const payload = buildChatCompletionPayload(
  defaults,
  [
    { role: "system", content: "只输出 JSON。" },
    { role: "user", content: '{"ok":true}' }
  ],
  { json: true, maxTokens: 64 }
);
assert.equal(payload.model, "deepseek-v4-flash");
assert.equal(payload.max_tokens, 64);
assert.deepEqual(payload.response_format, { type: "json_object" });
assert.deepEqual(payload.thinking, { type: "disabled" });
assert.equal("stream" in payload, false);

const customOpenAiCompatible: ModelProviderConfig = {
  id: "custom-provider",
  provider: "OpenAI Compatible",
  baseURL: "https://example.com/v1",
  apiKey: "sk-test",
  model: "custom-json-model",
  temperature: 0.3,
  enabled: true,
  updatedAt: new Date(0).toISOString()
};
const customPayload = buildChatCompletionPayload(customOpenAiCompatible, [{ role: "user", content: "hi" }], { json: true });
assert.equal("thinking" in customPayload, false);

assert.equal(validateProviderConfig({ ...defaults, enabled: true, apiKey: "sk-test" }).ok, true);
assert.equal(validateProviderConfig({ ...defaults, enabled: true, apiKey: "" }).ok, false);

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  await new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      reject(error);
    });
  });
  throw new Error("unreachable");
}) as typeof fetch;

await assert.rejects(
  () => callChatCompletion(
    { ...defaults, enabled: true, apiKey: "sk-test" },
    [{ role: "user", content: "timeout test" }],
    { timeoutMs: 5 }
  ),
  /超时/
);
globalThis.fetch = originalFetch;

assert.deepEqual(parseJsonObject('说明文字 {"ok": true, "items": [1, 2]} 结束'), {
  ok: true,
  items: [1, 2]
});
assert.throws(() => parseJsonObject("not-json"), /没有找到可解析的 JSON/);

console.log("Provider contract passed.");

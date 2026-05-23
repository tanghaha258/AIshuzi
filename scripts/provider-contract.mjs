import assert from "node:assert/strict";
import { createDeepSeekDefaults } from "../dist/server/server/ai/deepseek.js";
import { parseJsonObject } from "../dist/server/server/ai/json.js";
import { buildChatCompletionPayload } from "../dist/server/server/ai/provider.js";

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
assert.equal("stream" in payload, false);

assert.deepEqual(parseJsonObject('说明文字 {"ok": true, "items": [1, 2]} 结束'), {
  ok: true,
  items: [1, 2]
});
assert.throws(() => parseJsonObject("not-json"), /没有找到可解析的 JSON/);

console.log("Provider contract passed.");

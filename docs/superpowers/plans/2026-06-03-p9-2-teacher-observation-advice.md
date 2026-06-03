# P9.2 Teacher Observation Advice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn teacher-camera observation metrics into real-time, teacher-facing advice in the existing "即时教学建议" flow.

**Architecture:** Keep `src/server/services/observationService.ts` as the single server-side boundary for observation normalization, event creation, and advice text. Extend its optional `system_suggestion` output with a deterministic advice classifier that emits one top-priority teacher action per observation. Reuse the current training room suggestion panel and event timeline; do not add a new UI channel or save camera media.

**Tech Stack:** TypeScript, Node/tsx contract scripts, existing Express route and `system_suggestion` classroom event model.

---

### Task 1: Red Contract For Teacher-Facing Camera Advice

**Files:**
- Modify: `scripts/observation-contract.ts`

- [ ] **Step 1: Replace the old device-first assertion and add advice rule cases**

Replace the existing obvious-issue assertion:

```ts
assert.match(issue.suggestionEvent?.content ?? "", /摄像头|画面|稳定/);
```

with this teacher-facing priority assertion:

```ts
assert.match(issue.suggestionEvent?.content ?? "", /镜头中央|补足光线|观察建议|可靠/);
assert.doesNotMatch(issue.suggestionEvent?.content ?? "", /抬头|手势|固定站位/);
```

Then add these helper functions and assertions immediately after that assertion:

```ts
function suggestionFor(input: typeof validObservation) {
  return buildTeacherObservationEvents("session-1", input, { now }).suggestionEvent?.content ?? "";
}

const lowConfidenceAdvice = suggestionFor({
  ...validObservation,
  faceVisible: false,
  faceConfidence: 18,
  headDirection: "down",
  expressionActivity: 6,
  stability: 20
});
assert.match(lowConfidenceAdvice, /镜头中央|补足光线|观察建议|可靠/);
assert.doesNotMatch(lowConfidenceAdvice, /抬头|手势|站位/);

const downAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
});
assert.match(downAdvice, /抬头|学生区|下一轮提问|复述/);

const sideAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "left",
  expressionActivity: 50,
  stability: 74
});
assert.match(sideAdvice, /视线|学生区|偏离镜头/);

const unstableAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "front",
  expressionActivity: 50,
  stability: 21
});
assert.match(unstableAdvice, /固定站位|设备|继续讲解|数据失真/);

const lowExpressionAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 82,
  headDirection: "front",
  expressionActivity: 12,
  stability: 74
});
assert.match(lowExpressionAdvice, /关键概念|停顿|重音|手势/);

const healthyAdvice = suggestionFor({
  ...validObservation,
  faceConfidence: 86,
  headDirection: "front",
  expressionActivity: 55,
  stability: 76
});
assert.equal(healthyAdvice, "");
```

- [ ] **Step 2: Run the focused contract and confirm RED**

Run: `npm run test:observation`

Expected: FAIL because current suggestion text is device-first, concatenates several tips, and does not cover expression activity.

### Task 2: Minimal Advice Classifier

**Files:**
- Modify: `src/server/services/observationService.ts`

- [ ] **Step 1: Add a classifier type and priority function**

Add this near the existing label helpers in `src/server/services/observationService.ts`:

```ts
interface TeacherObservationAdvice {
  label: string;
  action: string;
}

function classifyTeacherObservationAdvice(observation: TeacherObservationPayload): TeacherObservationAdvice | undefined {
  if (!observation.faceVisible || observation.faceConfidence < 35) {
    return {
      label: "observation-reliability",
      action: "先回到镜头中央并补足光线，后续观察建议才会更可靠。"
    };
  }
  if (observation.headDirection === "down") {
    return {
      label: "look-up-before-question",
      action: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。"
    };
  }
  if (observation.headDirection === "left" || observation.headDirection === "right" || observation.headDirection === "up") {
    return {
      label: "return-attention-to-students",
      action: "讲解时把视线转回学生区，减少长时间偏离镜头。"
    };
  }
  if (observation.stability < 35) {
    return {
      label: "stabilize-before-continuing",
      action: "先固定站位或设备，再继续讲解，避免观察数据失真。"
    };
  }
  if (observation.faceConfidence >= 35 && observation.expressionActivity < 25) {
    return {
      label: "emphasize-key-concept",
      action: "讲到关键概念时加入一次停顿、重音或手势强调。"
    };
  }
  return undefined;
}
```

- [ ] **Step 2: Replace concatenated suggestion text**

Change `buildSuggestionContent(observation)` to:

```ts
function buildSuggestionContent(observation: TeacherObservationPayload) {
  const advice = classifyTeacherObservationAdvice(observation);
  return advice ? `建议：${advice.action}` : "";
}
```

- [ ] **Step 3: Run the focused contract and confirm GREEN**

Run: `npm run test:observation`

Expected: PASS.

### Task 3: Suggestion Metadata For Future Dedupe

**Files:**
- Modify: `scripts/observation-contract.ts`
- Modify: `src/server/services/observationService.ts`

- [ ] **Step 1: Add failing metadata assertions**

In `scripts/observation-contract.ts`, after `downAdvice`, add:

```ts
const downAdviceEvent = buildTeacherObservationEvents("session-1", {
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
}, { now }).suggestionEvent;
assert.equal(downAdviceEvent?.metadata.source, "teacher_observation");
assert.equal(downAdviceEvent?.metadata.adviceLabel, "look-up-before-question");
assert.equal(downAdviceEvent?.metadata.advicePriority, 2);
assert.deepEqual(downAdviceEvent?.metadata.observation, {
  ...validObservation,
  faceConfidence: 82,
  headDirection: "down",
  expressionActivity: 50,
  stability: 74
});
```

- [ ] **Step 2: Run the focused contract and confirm RED**

Run: `npm run test:observation`

Expected: FAIL because suggestion metadata does not yet include `adviceLabel` or `advicePriority`.

- [ ] **Step 3: Extend classifier and metadata**

Change the interface to include priority:

```ts
interface TeacherObservationAdvice {
  label: string;
  priority: number;
  action: string;
}
```

Add priority values to classifier returns:

```ts
priority: 1
priority: 2
priority: 3
priority: 4
priority: 5
```

Replace `buildSuggestionContent` with this exact wrapper:

```ts
function buildSuggestionContent(advice: TeacherObservationAdvice) {
  return `建议：${advice.action}`;
}
```

In `buildTeacherObservationEvents`, compute the advice once before `suggestionContent`:

```ts
const advice = classifyTeacherObservationAdvice(observation);
const suggestionContent = advice ? buildSuggestionContent(advice) : "";
```

Then set suggestion metadata to:

```ts
metadata: {
  source: "teacher_observation",
  adviceLabel: advice?.label,
  advicePriority: advice?.priority,
  observation
}
```

Remove the old observation-accepting `buildSuggestionContent(observation: TeacherObservationPayload)` function signature so the service only classifies once per request.

- [ ] **Step 4: Run the focused contract and confirm GREEN**

Run: `npm run test:observation`

Expected: PASS.

### Task 4: Verification And Git

**Files:**
- Verify: `package.json`
- Verify: git state

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm run test:observation
npm run smoke
```

Expected: both commands exit 0. Smoke confirms the teacher-observation route still returns a suggestion for an obvious camera issue.

- [ ] **Step 2: Run typecheck and full check**

Run:

```powershell
npm run typecheck
npm run check
```

Expected: both commands exit 0. Existing Vite chunk-size warnings and Node SQLite experimental warnings are acceptable if commands exit 0.

- [ ] **Step 3: Inspect git status**

Run: `git status --short`

Expected: only these tracked files are modified for P9.2 implementation:

```text
M scripts/observation-contract.ts
M src/server/services/observationService.ts
```

Untracked local files such as `dev-server.err.log` or `登录页/` must remain unstaged.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- docs/superpowers/plans/2026-06-03-p9-2-teacher-observation-advice.md scripts/observation-contract.ts src/server/services/observationService.ts
git commit -m "feat: add teacher observation advice"
```

Expected: commit succeeds.

- [ ] **Step 5: Push**

Run:

```powershell
git push origin codex/p9-1-camera-device-diagnostics
```

Expected: branch pushes to the existing PR.

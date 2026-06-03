# P10.1 Report Retraining Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and display structured retraining templates when a report recommendation creates a new training target.

**Architecture:** Keep the existing report-to-training-target route and `TrainingTarget` lifecycle. Add a required `template` object to `TrainingTarget`, build it deterministically inside `src/server/db.ts` from the selected recommendation and report context, persist it as JSON in `training_targets.template`, and render it in the training room's existing target and suggestion areas.

**Tech Stack:** TypeScript, React, Express, Node SQLite, tsx contract scripts, existing CSS/UI contract checks.

---

### Task 1: Red Contract For Retraining Templates

**Files:**
- Modify: `scripts/training-target-contract.ts`

- [x] **Step 1: Add template assertions to the existing target contract**

After `assert.deepEqual(result.target.evidenceEventIds, recommendation.evidenceEventIds);`, add:

```ts
assert.equal(result.target.template.type, "concept-check");
assert.match(result.target.template.title, /复训|关键概念|小步/);
assert.match(result.target.template.scenario, new RegExp(recommendation.title));
assert.ok(result.target.template.steps.length >= 3);
assert.ok(result.target.template.successCriteria.length >= 3);
assert.ok(result.target.template.evidencePrompts.length >= 2);
assert.ok(result.target.template.focusMetrics.includes("clarity"));
assert.ok(result.target.template.focusMetrics.includes("questioning"));
assert.match(result.target.template.steps.join(" "), /复述|关键步骤|等量关系/);
assert.match(result.target.template.successCriteria.join(" "), /学生|复述|确认/);
assert.match(result.target.template.evidencePrompts.join(" "), /证据|学生/);
```

After `assert.equal(storedTarget?.sessionId, result.session.id);`, add:

```ts
assert.deepEqual(storedTarget?.template, result.target.template);
```

- [x] **Step 2: Add a camera-presence template case**

Before deleting the course, add a camera observation event, generate a second report, save it, select a camera-related recommendation, and assert:

```ts
store.addEvent({
  id: "target-camera-1",
  sessionId: session.id,
  type: "teacher_observation",
  actor: "教师观察",
  content: "教师镜头观察：下一轮提问前先抬头看向学生区。",
  timestamp: "2026-05-24T10:02:00.000Z",
  metadata: {
    source: "teacher_observation",
    adviceLabel: "look-up-before-question",
    observation: {
      source: "mediapipe",
      faceVisible: true,
      faceConfidence: 82,
      headDirection: "down",
      expressionActivity: 30,
      stability: 68,
      capturedAt: "2026-05-24T10:02:00.000Z"
    }
  }
});
const cameraReport = createLocalEvaluationReport({
  session: completedSession,
  events: store.listEvents(session.id),
  students,
  generatedAt: "2026-05-24T10:12:00.000Z"
});
cameraReport.recommendations.unshift({
  title: "优化教师镜头交流",
  detail: "教师镜头观察显示存在低头或视线偏离，下一轮需要把观察数据转成课堂交流动作。",
  priority: "medium",
  action: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。",
  evidenceEventIds: ["target-camera-1"]
});
store.saveReport(cameraReport);
const cameraTargetResult = store.createTrainingTargetFromRecommendation(cameraReport.id, "优化教师镜头交流");
assert.ok(cameraTargetResult, "camera recommendation should create a retraining target");
assert.equal(cameraTargetResult.target.template.type, "camera-presence");
assert.match(cameraTargetResult.target.template.steps.join(" "), /抬头|学生区|复述|站位/);
assert.match(cameraTargetResult.target.template.successCriteria.join(" "), /正对|视线|镜头/);
assert.ok(cameraTargetResult.target.template.focusMetrics.includes("teacherObservation.frontFacingRate"));
```

- [x] **Step 3: Run the focused contract and confirm RED**

Run: `npm run test:training-target`

Expected: FAIL because `TrainingTarget` has no `template` field yet.

### Task 2: Shared Type And Database Persistence

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`

- [x] **Step 1: Add template types**

Add `TrainingTargetTemplateType` and `TrainingTargetTemplate` before `TrainingTarget`, then add `template: TrainingTargetTemplate;` to `TrainingTarget`.

- [x] **Step 2: Add the SQLite migration**

Change `schemaVersion` from `7` to `9`. Add a version 8 migration for `training_targets.template` and a version 9 migration for `reports.teacher_observation`. Keep the initial `training_targets` table definition unchanged so a fresh database can run the same `ALTER TABLE` path without duplicate-column errors:

```ts
if (currentVersion < 8) {
  db.exec(`
    ALTER TABLE training_targets ADD COLUMN template TEXT NOT NULL DEFAULT '{}';
    PRAGMA user_version = ${schemaVersion};
  `);
}

if (currentVersion < 9) {
  db.exec(`
    ALTER TABLE reports ADD COLUMN teacher_observation TEXT;
    PRAGMA user_version = ${schemaVersion};
  `);
}
```

- [x] **Step 3: Parse and persist template JSON**

Import `TrainingTargetTemplate`. Update `rowToTrainingTarget()` to parse `row.template` with a safe fallback. Update the insert statement and values in `createTrainingTargetFromRecommendation()` to include `template`. Also persist and restore `report.teacherObservation` so camera-derived report context survives reloads and can drive camera-presence retraining templates.

- [x] **Step 4: Run focused contract**

Run: `npm run test:training-target`

Expected: still FAIL until the generator creates meaningful template content.

### Task 3: Deterministic Template Generator

**Files:**
- Modify: `src/server/db.ts`

- [x] **Step 1: Add `createTrainingTargetTemplate()` helper**

Add a local helper that accepts `report` and `recommendation`, classifies the template type, and returns full template content. It must create four deterministic variants: `concept-check`, `strategy-follow-up`, `participation-recovery`, and `camera-presence`.

- [x] **Step 2: Attach the template during target creation**

Set:

```ts
template: createTrainingTargetTemplate(report, recommendation),
```

inside the `target` object.

- [x] **Step 3: Run focused contract and confirm GREEN**

Run: `npm run test:training-target`

Expected: PASS.

### Task 4: Training Room Template UI

**Files:**
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [x] **Step 1: Render template summary in the target banner**

Inside `.training-target-banner`, render:

```tsx
<em>{trainingTarget.template.title}</em>
<small>{trainingTarget.template.scenario}</small>
```

- [x] **Step 2: Render the operational template in the suggestion panel**

Inside `.training-target-focus`, render a `.training-target-template` section with:

- `.training-target-template__steps`
- `.training-target-template__criteria`
- `.training-target-template__evidence`
- `.training-target-template__metrics`

Each section should map the corresponding template arrays.

- [x] **Step 3: Add compact CSS selectors**

Add styles for the new selectors, keeping them inside the existing suggestion panel and avoiding nested cards.

- [x] **Step 4: Extend UI contract**

Add the new selectors to `requiredTrainingRoomSelectors` and add a layout assertion that `TrainingRoom.tsx` reads `trainingTarget.template`.

- [x] **Step 5: Run UI contract**

Run: `npm run test:ui`

Expected: PASS.

### Task 5: Verification And Plan Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-06-03-p10-1-report-retraining-template.md`

- [x] **Step 1: Run focused checks**

Run:

```bash
npm run test:training-target
npm run test:ui
npm run typecheck
```

Expected: all PASS.

- [x] **Step 2: Run broader safety checks**

Run:

```bash
npm run smoke
npm run check
```

Expected: all PASS, allowing existing SQLite experimental warnings and Vite chunk-size warnings.

- [x] **Step 3: Update this plan checklist**

Mark completed steps with `[x]` after verification.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-03-p10-1-report-retraining-template-design.md docs/superpowers/plans/2026-06-03-p10-1-report-retraining-template.md scripts/training-target-contract.ts scripts/ui-contract.mjs src/shared/types.ts src/server/db.ts src/server/db/migrations.ts src/client/components/TrainingRoom.tsx src/client/styles.css
git commit -m "feat: add report retraining templates"
```

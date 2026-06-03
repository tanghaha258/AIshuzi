# P9.3 Camera Observation Report Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn real-time teacher camera observations into a privacy-safe, evidence-bound report section.

**Architecture:** Keep all image analysis in the browser and backend event payloads as numeric `TeacherObservationPayload` metrics. Add a server-side report aggregation helper that summarizes teacher camera observations from existing `teacher_observation` classroom events, then render that summary in reports and exports. The UI only displays aggregated metrics and linked evidence ids, never photos, frames, or video.

**Tech Stack:** React 19, TypeScript, Vite, Node/tsx contract scripts, existing SQLite-backed classroom event model.

---

### Task 1: Report Types And Failing Contract

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `scripts/report-generator-contract.ts`

- [x] **Step 1: Add the failing report contract**

Extend `scripts/report-generator-contract.ts` with multiple `teacher_observation` events and assertions for a new `report.teacherObservation` object:

```ts
assert.ok(report.teacherObservation);
assert.equal(report.teacherObservation.sampleCount, 4);
assert.ok(report.teacherObservation.faceVisibleRate < 100);
assert.ok(report.teacherObservation.frontFacingRate < 100);
assert.ok(report.teacherObservation.evidenceEventIds.includes("event-vision-low-confidence"));
assert.match(report.teacherObservation.summary, /摄像头|镜头|低头|偏离|置信度/);
assert.match(renderReportMarkdown(report), /教师镜头观察/);
assert.match(renderReportHtml(report), /教师镜头观察/);
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:report-generator`

Expected: FAIL because `EvaluationReport` has no `teacherObservation` summary yet.

- [x] **Step 3: Add the shared type**

Add this interface to `src/shared/types.ts` and reference it from `EvaluationReport`:

```ts
export interface ReportTeacherObservation {
  sampleCount: number;
  faceVisibleRate: number;
  averageConfidence: number;
  frontFacingRate: number;
  averageStability: number;
  issueCount: number;
  issueLabels: string[];
  evidenceEventIds: string[];
  summary: string;
}
```

- [x] **Step 4: Run the focused test and keep RED**

Run: `npm run test:report-generator`

Expected: still FAIL because aggregation has not been implemented.

### Task 2: Server-Side Observation Aggregation

**Files:**
- Modify: `src/server/services/reportGenerator.ts`
- Modify: `scripts/report-generator-contract.ts`

- [x] **Step 1: Implement the minimal aggregation helper**

In `src/server/services/reportGenerator.ts`, add a helper that reads `event.metadata.observation`, filters valid camera metric objects, calculates:

- `sampleCount`
- `faceVisibleRate`
- `averageConfidence`
- `frontFacingRate`
- `averageStability`
- `issueCount`
- `issueLabels`
- `evidenceEventIds`
- `summary`

Rules:
- Low confidence issue: `faceVisible === false` or `faceConfidence < 45`
- Direction issue: `headDirection !== "front"` and not `"unknown"`
- Stability issue: `stability < 45`
- Evidence ids: newest issue events first, then newest normal observation events, max 6.

- [x] **Step 2: Attach the summary to local reports**

Set `const teacherObservation = createTeacherObservationSummary(events);` in `createLocalEvaluationReport()` and include it in the returned report.

- [x] **Step 3: Add export sections**

Add `## 教师镜头观察` to Markdown and a matching `<section>` to HTML when `report.teacherObservation` exists.

- [x] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:report-generator`

Expected: PASS.

### Task 3: Report Page UI Section

**Files:**
- Modify: `scripts/ui-contract.mjs`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/styles.css`

- [x] **Step 1: Extend the UI contract**

Require these selectors:

```js
".report-teacher-observation",
".report-teacher-observation__metrics",
".report-teacher-observation__issues",
".report-teacher-observation__evidence"
```

Require `ReportsPage.tsx` to read `report.teacherObservation`.

- [x] **Step 2: Run the UI test and confirm RED**

Run: `npm run test:ui`

Expected: FAIL because the report page has no teacher camera observation section yet.

- [x] **Step 3: Render the report section**

In `ReportsPage.tsx`, place a compact `report-teacher-observation` block after the overview strip and before process evaluation. Show:

- sample count
- face visible rate
- average confidence
- front-facing rate
- average stability
- issue labels
- evidence actors / ids

- [x] **Step 4: Style the section**

Add CSS for the four selectors. Use the existing report card visual language and avoid nested cards.

- [x] **Step 5: Run UI test and confirm GREEN**

Run: `npm run test:ui`

Expected: PASS.

### Task 4: Verification And Git

**Files:**
- Verify: `package.json`
- Verify: git state

- [x] **Step 1: Run focused checks**

Run:

```powershell
npm run test:report-generator
npm run test:ui
npm run typecheck
```

Expected: all commands exit 0.

- [x] **Step 2: Run build**

Run: `npm run build`

Expected: exit 0. Chunk-size warnings from Vite are acceptable if the build succeeds.

- [x] **Step 3: Run full check**

Run: `npm run check`

Expected: exit 0.

- [ ] **Step 4: Commit and push**

Commit message:

```bash
git add docs/superpowers/plans/2026-05-29-p9-1-camera-device-diagnostics.md docs/superpowers/plans/2026-05-29-p9-3-camera-observation-report-loop.md src/shared/types.ts src/server/services/reportGenerator.ts src/client/components/ReportsPage.tsx src/client/styles.css scripts/report-generator-contract.ts scripts/ui-contract.mjs
git commit -m "feat: add camera observation report loop"
git push origin codex/p9-1-camera-device-diagnostics
```

# P8 Process Evidence Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real process-evaluation loop: teachers can record evaluation evidence during a micro-teaching session, and the post-class report prioritizes those records as traceable evidence.

**Architecture:** Add a `process_evaluation` classroom event type and a focused server helper for creating validated evidence events. The training room records evidence through a dedicated API, stores it in SQLite via the existing events table, and report generation treats these events as high-priority evidence for the existing `ReportProcessEvaluation` block.

**Tech Stack:** React + Vite + TypeScript frontend, Express backend, Node SQLite store, existing contract scripts with `tsx`.

---

## Progress Update - 2026-05-26

P8 is implemented and verified. The training room now has a compact process-evidence panel for teacher-recorded evidence, the backend persists those records as `process_evaluation` classroom events, and the report generator prioritizes those events in the process-evaluation summary and evidence chain.

Verification completed:
- `npm run test:process-evaluation`
- `npm run test:report-generator`
- `npm run test:ui`
- `npm run typecheck`
- `npm run build`
- `npm run check`
- Local API smoke for `POST /api/sessions/:id/process-evidence`, verified persisted event type `process_evaluation` and evidence type `学生复述`.

Browser automation caveat: the in-app browser automation bridge timed out twice while opening `http://localhost:5173/#training`, so visual verification was covered by the UI contract and production build, while the live data path was verified through the running local API.

### Task 1: Red Contract For Process Evidence

**Files:**
- Create: `scripts/process-evaluation-contract.ts`
- Modify: `package.json`

- [x] **Step 1: Write the failing contract**

Create `scripts/process-evaluation-contract.ts` that:
- creates a disposable SQLite database;
- creates a course, session, lesson plan, and one `process_evaluation` classroom event;
- asserts the event persists with `evidenceType`, `targetStudentId`, `processFocus`, and `source`;
- asserts `buildReportEvidence()` includes `process_evaluation` as a high-priority evidence node;
- asserts `createLocalEvaluationReport()` binds that event into `report.processEvaluation.evidenceEventIds`;
- asserts Markdown and HTML exports contain the process-evaluation evidence wording.

- [x] **Step 2: Wire the script into package scripts**

Add:

```json
"test:process-evaluation": "tsx scripts/process-evaluation-contract.ts"
```

and include it in `npm run check` before `test:report-generator`.

- [x] **Step 3: Verify red**

Run:

```bash
npm run test:process-evaluation
```

Expected: FAIL because `process_evaluation` is not yet a first-class event type and report evidence does not prioritize it.

### Task 2: Red UI Contract For Training Evidence Entry

**Files:**
- Modify: `scripts/ui-contract.mjs`

- [x] **Step 1: Add UI selectors**

Require these selectors:

```js
".process-evidence-panel",
".process-evidence-type-grid",
".process-evidence-student-select",
".process-evidence-note",
".process-evidence-list",
".process-evidence-card"
```

Also assert `TrainingRoom.tsx` calls `api.recordProcessEvidence`.

- [x] **Step 2: Verify red**

Run:

```bash
npm run test:ui
```

Expected: FAIL because the training room has no process-evidence entry panel yet.

### Task 3: Server Event Model And API

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/server/services/processEvaluationService.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/api.ts`

- [x] **Step 1: Add shared types**

Add `process_evaluation` to `EventType`, plus:
- `ProcessEvidenceType`;
- `RecordProcessEvidencePayload`;
- `RecordProcessEvidenceResult`.

- [x] **Step 2: Add server helper**

Create a helper that validates evidence type, target student, and note. It returns an event draft with actor `过程评价`, content that includes evidence type, target, and note, and metadata:

```ts
{
  evidenceType,
  targetStudentId,
  targetStudentName,
  processFocus,
  peerReviewPrompt,
  source: "teacher-manual"
}
```

- [x] **Step 3: Add endpoint**

Add `POST /api/sessions/:id/process-evidence`. It requires an existing non-completed session, resolves the course lesson plan, saves the event with `store.addEvent()`, and returns `{ event }`.

- [x] **Step 4: Add client API**

Add `api.recordProcessEvidence(sessionId, payload)`.

- [x] **Step 5: Verify green for process contract**

Run:

```bash
npm run test:process-evaluation
```

Expected: PASS.

### Task 4: Report Evidence Priority

**Files:**
- Modify: `src/server/services/reportGenerator.ts`
- Modify: `scripts/report-generator-contract.ts`

- [x] **Step 1: Include process-evaluation evidence**

Add `process_evaluation` to important report evidence types, give it the highest weight, and write a reason that explicitly says it is teacher-recorded process-evaluation evidence.

- [x] **Step 2: Bind process evidence to process-evaluation summary**

Update `createProcessEvaluation()` so it first selects `process_evaluation` evidence nodes, then falls back to student/teacher/system nodes. Update the summary to mention when manually recorded process evidence exists.

- [x] **Step 3: Extend report contract**

Add one `process_evaluation` event to `scripts/report-generator-contract.ts` and assert report evidence and process evaluation reference it.

- [x] **Step 4: Verify report tests**

Run:

```bash
npm run test:report-generator
```

Expected: PASS.

### Task 5: Training Room Evidence Entry UI

**Files:**
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/client/styles.css`

- [x] **Step 1: Add local state**

Track:
- selected evidence type;
- selected target student or whole class;
- note text;
- submit status and error.

- [x] **Step 2: Add panel below teacher input**

Add `.process-evidence-panel` below the speech/transcript panel. Include:
- evidence type quick buttons;
- student select;
- note textarea;
- save button;
- recent process evidence list.

- [x] **Step 3: Submit and append event**

Call `api.recordProcessEvidence()`, append the returned event to the local timeline, and clear the note.

- [x] **Step 4: Style compactly**

Use the existing dark training-card language, keep it below the teacher input, and ensure no fixed-height overflow on ordinary notebook screens.

- [x] **Step 5: Verify UI contract**

Run:

```bash
npm run test:ui
```

Expected: PASS.

### Task 6: Full Verification And Push

**Files:**
- Modify: `docs/superpowers/plans/2026-05-26-p8-process-evidence-loop.md`

- [x] **Step 1: Run focused checks**

```bash
npm run test:process-evaluation
npm run test:report-generator
npm run test:ui
npm run typecheck
npm run build
```

- [x] **Step 2: Run full check**

```bash
npm run check
```

- [x] **Step 3: Browser verification**

Open `http://localhost:5173/#training`, record one process-evaluation evidence item, and confirm it appears in the classroom timeline.

- [x] **Step 4: Update progress**

Mark this plan with a progress update noting completed checks and any browser caveats.

- [x] **Step 5: Commit and push**

```bash
git add docs/superpowers/plans/2026-05-26-p8-process-evidence-loop.md scripts package.json src
git commit -m "feat: add process evaluation evidence loop"
git push origin codex/p6-report-v2
```

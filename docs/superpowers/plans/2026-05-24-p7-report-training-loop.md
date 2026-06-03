# P7 Report Training Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn reports, courses, sessions, and AI students into a manageable training loop instead of one-off demo screens.

**Architecture:** P7 starts with list-management hardening because the product already has enough generated data to expose layout and retrieval problems. After the workbench is stable, the report evidence chain will become the entry point for creating the next training target.

**Tech Stack:** React, TypeScript, Express API, SQLite, existing UI contract scripts, existing DeepSeek-compatible provider layer.

---

## Progress Update - 2026-05-24

- P7-0 list and layout governance is complete: dashboard course cards, training session records, planner setup lists, and report lists now support search, pagination, bounded layouts, and delete actions where needed.
- Report deletion is wired through the client and local API; deleting a report keeps the training session record but removes the report and derived report evidence events.
- P7 Task 5 is complete: report evidence can be traced back to nearby local classroom events without sending extra classroom data to the model.
- P7 Task 6 is complete: report recommendations can create a new draft training session with an active复训目标 shown in the training room.
- P7 Task 6 follow-up is complete: training targets now move to `completed` when the linked复训 session completes, and historical reports can still create复训 sessions after the original course entry is deleted.
- Next phase: continue from the new training target into stronger复训模板 and higher-level report-to-practice analytics.

---

## Progress Update - 2026-05-26

- P7.1 starts from product logic rather than visuals: lesson-planning fields should be empty by default, with example content shown as placeholders and filled only when the user clicks `填入示例`.
- P7.1 adds a lightweight process-evaluation design to lesson planning: evaluation focus, evaluation method, peer/self-review prompt, and evidence type.
- The generated lesson plan should carry process-evaluation guidance at two levels: overall evaluation design and a per-stage evaluation point.
- The report should summarize the configured process-evaluation design and link it to classroom evidence, so the loop becomes `备课评价设计 -> 试讲事件 -> 课后证据`.
- Implementation status: backend contracts, UI contracts, typecheck, build, and data lifecycle checks pass locally. Browser plugin visual verification timed out twice, so visual confirmation should be rechecked manually in the running app.

---

## Current P7-0 Scope: List And Layout Governance

### Task 1: Workbench Course List Controls

**Files:**
- Modify: `src/client/components/Dashboard.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [x] Add a search input above the course training cards.
- [x] Paginate course cards so the workbench does not become an infinite scroll.
- [x] Keep `开始实训` buttons pinned to the bottom of cards even when objectives have different lengths.
- [x] Prevent the right-side dashboard panels from stretching to match the long course list.
- [x] Add UI contract selectors: `.list-toolbar`, `.search-input`, `.pagination-controls`, `.course-card__actions`.

### Task 2: Session Management

**Files:**
- Modify: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/Dashboard.tsx`
- Modify: `src/client/styles.css`

- [x] Wire the existing `DELETE /api/sessions/:id` route into the client API.
- [x] Add a workbench `实训记录` panel with search and pagination.
- [x] Add `打开` and `删除` actions for each training session.
- [x] Refresh dashboard data after deletion and clear the active session if it was deleted.
- [x] Add UI contract selectors: `.session-list`, `.session-card`, `.session-card__actions`, `.delete-session-button`.

### Task 3: Planner Setup List Repair

**Files:**
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Modify: `src/client/styles.css`

- [x] Add search and pagination to the `创建微格实训` course selector.
- [x] Limit the course and student selector height with scrollable bounded lists.
- [x] Stop student selection cards from stretching into tall blank panels.
- [x] Add UI contract selectors: `.planner-list-panel`, `.bounded-list`.

### Task 4: Report List Controls

**Files:**
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/styles.css`

- [x] Add report search over course, topic, summary, evidence, and recommendation text.
- [x] Paginate detailed reports one report per page.
- [x] Keep the detailed report layout from rendering all historical reports in a single endless page.
- [x] Add UI contract selector: `.report-list-toolbar`.

## Next P7 Tasks

### Task 5: Evidence Drilldown

**Files:**
- Modify: `src/server/db.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/shared/types.ts`
- Test: `scripts/report-evidence-context-contract.ts`

- [x] Add an API response shape that returns source classroom events for report evidence IDs.
- [x] In the report page, let evidence nodes expand to show nearby teacher/student/system events.
- [x] Keep evidence drilldown read-only and local; do not send extra classroom data to the model.

### Task 6: Recommendation To Training Target

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/components/TrainingRoom.tsx`
- Test: `scripts/training-target-contract.ts`

- [x] Add a lightweight training target object linked to `reportId`, `recommendationTitle`, and evidence IDs.
- [x] Add a report action that creates a new session with the recommendation as the next training goal.
- [x] Show the active training target in the training room header and immediate teaching suggestion area.
- [x] Mark the active training target completed when the linked复训 session completes.
- [x] Allow historical reports to create复训 sessions even after the original course entry has been deleted.

### Task 7: Planner Examples And Process Evaluation

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/ai/prompts.ts`
- Modify: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/services/reportGenerator.ts`
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Modify: `src/client/components/planner/LessonPlanPanel.tsx`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/styles.css`
- Test: `scripts/lesson-planner-contract.ts`
- Test: `scripts/report-generator-contract.ts`
- Test: `scripts/ui-contract.mjs`

- [x] Convert planner defaults to empty input values and move demo content into placeholders.
- [x] Add a `填入示例` action that deliberately populates a full example lesson.
- [x] Add a process-evaluation design object to lesson-plan generation payloads and persisted lesson plans.
- [x] Generate per-stage process-evaluation points in local and model lesson plans.
- [x] Show the process-evaluation design and stage evaluation points in the generated script panel.
- [x] Carry the lesson-plan process-evaluation design into the completed report.
- [x] Show a process-evaluation summary in the report detail view, including evidence IDs for review.

## Verification

- [x] `npm run test:ui`
- [x] `npm run test:lesson-planner`
- [x] `npm run test:report-generator`
- [x] `npm run test:data-lifecycle`
- [x] `npm run test:report-evidence-context`
- [x] `npm run test:training-target`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run check`
- [x] Browser screenshot: dashboard at 1366px
- [x] Browser screenshot: planner at 1366px
- [x] Browser screenshot: reports at 1366px
- [x] Browser/CDP check: report evidence drilldown at 1366px (`output/playwright/report-evidence-context.png`)
- [x] Browser/CDP check: report recommendation to training target flow at 1366px (`output/playwright/training-target-flow.png`)

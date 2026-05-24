# P7 Report Training Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn reports, courses, sessions, and AI students into a manageable training loop instead of one-off demo screens.

**Architecture:** P7 starts with list-management hardening because the product already has enough generated data to expose layout and retrieval problems. After the workbench is stable, the report evidence chain will become the entry point for creating the next training target.

**Tech Stack:** React, TypeScript, Express API, SQLite, existing UI contract scripts, existing DeepSeek-compatible provider layer.

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
- Test: add report evidence context assertions to `scripts/report-generator-contract.ts` or a new API contract.

- [ ] Add an API response shape that returns source classroom events for report evidence IDs.
- [ ] In the report page, let evidence nodes expand to show nearby teacher/student/system events.
- [ ] Keep evidence drilldown read-only and local; do not send extra classroom data to the model.

### Task 6: Recommendation To Training Target

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/components/TrainingRoom.tsx`

- [ ] Add a lightweight training target object linked to `reportId`, `recommendationTitle`, and evidence IDs.
- [ ] Add a report action that creates a new session with the recommendation as the next training goal.
- [ ] Show the active training target in the training room header and immediate teaching suggestion area.

## Verification

- [x] `npm run test:ui`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run check`
- [x] Browser screenshot: dashboard at 1366px
- [x] Browser screenshot: planner at 1366px
- [x] Browser screenshot: reports at 1366px

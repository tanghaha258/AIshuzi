# Data Lifecycle Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make course plans, training sessions, and reports behave as distinct product objects with clear status labels and reliable deletion.

**Architecture:** Keep the current Express + SQLite + React structure. Add a small shared session lifecycle helper for status labels and reusable-session selection, add store/API deletion support for reports, and make session deletion cascade to runtime states and report evidence.

**Tech Stack:** TypeScript, React, Express, SQLite, current script-based contract tests.

---

### Task 1: Data Lifecycle Contract

**Files:**
- Create: `scripts/data-lifecycle-contract.ts`
- Modify: `package.json`

- [x] Add a script-level contract that uses an isolated SQLite database through `DATABASE_PATH`.
- [x] Assert `sessionStatusLabel("draft")` returns `未开始`.
- [x] Assert `findReusableSession` prefers active/draft sessions for the same course and ignores completed sessions.
- [x] Assert deleting a session removes its events, reports, and student runtime states.
- [x] Assert deleting a report removes the report and report evidence events but keeps the session.
- [x] Run `npm run test:data-lifecycle` and confirm it fails before implementation.

### Task 2: Backend Lifecycle Fixes

**Files:**
- Modify: `src/server/db.ts`
- Modify: `src/server/index.ts`

- [x] Add `deleteReport(reportId)` to the store.
- [x] Update `deleteSession(sessionId)` to delete `student_runtime_states` and report evidence events.
- [x] Add `DELETE /api/reports/:id`.
- [x] Run `npm run test:data-lifecycle` and confirm backend assertions pass.

### Task 3: Shared Status And Session Reuse

**Files:**
- Create: `src/shared/sessionLifecycle.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/Dashboard.tsx`

- [x] Implement `sessionStatusLabel` and `findReusableSession`.
- [x] Use the helper in Dashboard session cards and Training navigation.
- [x] When starting from a course card, open the existing unfinished session first and label the action as `继续实训`.
- [x] Keep explicit deletion for training sessions.
- [x] Run `npm run test:data-lifecycle`.

### Task 4: Report Delete UI

**Files:**
- Modify: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/ReportsPage.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [x] Add `api.deleteReport(reportId)`.
- [x] Pass `onDeleteReport` into `ReportsPage`.
- [x] Add a delete button to the visible report detail header.
- [x] Refresh dashboard data after deletion.
- [x] If the deleted report was visible, keep the user on the reports page and show the next report or empty state.
- [x] Add required report delete selector to the UI contract.

### Task 5: Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-05-24-data-lifecycle-cleanup.md`

- [x] Run `npm run test:data-lifecycle`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test:ui`.
- [x] Run `npm run build`.
- [x] Use the browser at `http://localhost:3001/#reports` and `http://localhost:3001/#` to verify no obvious layout break.
- [x] Update this plan with completed checkboxes and observed results.


## Implementation Notes

- 2026-05-24: Added `scripts/data-lifecycle-contract.ts` and wired `npm run test:data-lifecycle` into `npm run check`.
- 2026-05-24: `draft` now displays as `???`; Dashboard course cards reuse unfinished sessions by default and expose `????` when needed.
- 2026-05-24: Session deletion now clears events, reports, and student runtime states; startup prunes orphan runtime states.
- 2026-05-24: Report deletion is available through `DELETE /api/reports/:id` and the report detail header; it keeps the session and ordinary classroom events.
- 2026-05-24: Code review feedback fixed repeat-report lifecycle: repeated report saves replace the report id and clear old report evidence; completed sessions now reject repeated completion with `409`.
- Verification: `npm run check` passed after implementation. Playwright screenshots were captured at `output/playwright/dashboard-lifecycle.png` and `output/playwright/reports-delete.png`.

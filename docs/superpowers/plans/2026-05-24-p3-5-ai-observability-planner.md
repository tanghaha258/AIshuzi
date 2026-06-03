# P3.5 AI Observability And Planner Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI usage visible and trustworthy, and upgrade lesson planning from a single free-topic form into two teacher-facing preparation modes with a concrete teaching-method field in every stage.

**Architecture:** Add a model-call observation layer around the existing provider and generation services. AI features return `usedModel`, `fallbackReason`, and a persisted call log so the UI can explain whether DeepSeek was actually used. Lesson planning gains `planningMode` and `teachingMethod` fields while keeping the current local fallback; the UI exposes “教材课时备课” and “自由主题微格备课” modes.

**Tech Stack:** TypeScript, Express, SQLite migrations, React, existing OpenAI-compatible provider abstraction, existing lesson planner service.

---

## Progress Update

Updated on 2026-05-24:

- [x] User confirmed P4 should pause.
- [x] Confirmed current planner screenshot and latest `lesson_plans` rows are `generated_by: local`.
- [x] Confirmed model provider is configured and enabled locally, but planner generation silently falls back to local when the provider path fails.
- [x] Confirmed `POST /api/model-provider/scenario-test` can misreport “not enabled” if the request body omits `enabled: true`.
- [x] Created branch `codex/p3-5-ai-observability-planner`.
- [x] Created RED contract scaffolding for `test:ai-observability` in `package.json` and `scripts/ai-observability-contract.ts`.
- [x] Extended `scripts/lesson-planner-contract.ts` to require `teachingMethod` and textbook-mode planning fields.
- [x] Verified `npm run test:ai-observability` fails because `src/server/ai/observability.ts` does not exist yet.
- [x] Verified `npm run test:lesson-planner` fails because generated/normalized lesson stages do not provide `teachingMethod` yet.
- [x] Implemented observability, dual planning mode, fallback reasons, model-call persistence, planner AI status, and the stage teaching-method column.
- [x] Verified with `npm run check`.
- [x] Verified `http://localhost:5173/#planner` with Playwright: both planning modes render, textbook fields appear, generated scripts show fallback status and `教师教法`, and 1366px has no page-level horizontal overflow.

## Current Product State Snapshot

Updated on 2026-05-24 after code and plan audit:

- [x] P0/P1 baseline is present: local React/Vite + Express + SQLite app, DeepSeek-ready OpenAI-compatible provider, model settings page, and local fallback path.
- [x] P2 is present: AI students have persisted runtime state, visible status bubbles/poses, teacher-turn responses, passive ticks, and training-room event updates.
- [x] Training-room layout has been refined: camera/slide/input area, AI student stage, advice, pulse/radar, and timeline are already usable.
- [x] P3 lesson planner is present: planner page can generate a micro-teaching script, save a course/lesson plan, recommend students, and enter the training room.
- [x] DeepSeek usage is now observable in product data: provider failures return `fallbackReason` and `model_call_logs` persists recent model/fallback calls without API keys.
- [x] Lesson planning now separates “教材课时备课” from “自由主题微格备课”.
- [x] Lesson-plan stages now expose the requested “教师教法” field in the shared type, provider prompt, local fallback, SQLite round-trip, and UI table.
- [x] Provider request payload now includes DeepSeek JSON-mode guardrails and a request timeout, so external API/network stalls return a clear error instead of hanging.
- [x] Provider connection tests and scenario tests now write `model_call_logs`, not only real classroom/lesson calls.
- [x] Settings page now shows recent model calls with scenario, model, real-call/fallback/error status, duration, timestamp, and fallback reason.
- [x] Verified through product API on 2026-05-24: `/api/model-provider/test` returned `ok: true` using DeepSeek `deepseek-v4-flash` in 838ms, and `/api/model-provider/scenario-test` for lesson planning returned `ok: true` in 11496ms.
- [x] Verified Settings UI at `http://localhost:5173/#settings` in Chrome/Playwright: masked API key, recent model calls, real-call labels, and fallback reasons render at 1366x900.
- [ ] Report generation remains rules/local-first; it is not yet a DeepSeek-backed diagnostic report pipeline.
- [ ] Camera is still preview-only, speech recognition is browser Web Speech/manual fallback, and no real vision/audio intelligence is wired into the backend.

## User Cooperation Needed

- Confirm the DeepSeek model name to use for real tests, such as `deepseek-chat` or the exact model shown in the DeepSeek console. Do not paste the test API key again unless it changes.
- For “教材课时备课”, provide one real sample: 学科、年级、教材版本、册次、单元、课题、课时, plus any local教材/知识库 files if we want retrieval-based generation instead of prompt-only generation.
- When testing the training room, allow or deny camera/microphone permissions intentionally so both permission paths can be verified.
- After P3.5 lands, check the DeepSeek后台调用记录 against the platform’s new `model_call_logs` page/API to confirm the product and provider console agree.
- If the DeepSeek后台 still does not show the two successful tests above, capture the后台筛选时间范围 and model name; platform-side logs already prove the local product path returned `usedModel: true`.

### Task 1: Observability Contract Test

**Files:**
- Create: `scripts/ai-observability-contract.ts`
- Modify: `package.json`

- [x] Add `test:ai-observability` to `package.json` with command `tsx scripts/ai-observability-contract.ts`.
- [x] Include the new script in `npm run check` after `test:provider`.
- [x] Create a contract script that imports `createModelCallLog`, `sanitizeModelCallLog`, and `summarizeModelFailure` from `src/server/ai/observability.ts`.
- [x] Assert `createModelCallLog` records `scenario`, `provider`, `model`, `baseURL`, `status`, `durationMs`, `usedModel`, and `fallbackReason`.
- [x] Assert `sanitizeModelCallLog` never includes API keys or authorization headers.
- [x] Assert `summarizeModelFailure(new Error("401 bad key"))` returns a Chinese message containing “鉴权” or “API Key”.
- [x] Run `npm run test:ai-observability` and confirm it fails before implementation because `observability.ts` does not exist.

### Task 2: Planner Method Contract Test

**Files:**
- Modify: `scripts/lesson-planner-contract.ts`

- [x] Extend the lesson planner contract to assert every local and normalized stage has `teachingMethod`.
- [x] Assert local stages contain concrete methods such as “情境导入法”, “支架式讲解”, or “问题链教学”.
- [x] Assert `normalizeLessonPlanResult` accepts model JSON with `teachingMethod` and fills missing methods from defaults.
- [x] Assert `buildLocalLessonPlan` accepts `planningMode: "textbook"` plus textbook fields and includes textbook context in the overview.
- [x] Run `npm run test:lesson-planner` and confirm it fails before implementation because `teachingMethod` and `planningMode` do not exist.

### Task 3: Shared Types And SQLite Migration

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`

- [x] Add `PlanningMode = "free-topic" | "textbook"`.
- [x] Extend `LessonPlanStage` with `teachingMethod: string`.
- [x] Extend `GenerateLessonPlanPayload` with optional `planningMode`, `textbookVersion`, `volume`, `unit`, `lesson`, `课时`-equivalent `period`.
- [x] Add `ModelCallLog` shared type with fields: `id`, `scenario`, `provider`, `model`, `baseURL`, `status`, `usedModel`, `fallbackReason`, `durationMs`, `createdAt`.
- [x] Increase migration version to `4`.
- [x] Add nullable `planning_mode`, `textbook_version`, `volume`, `unit`, `lesson`, `period` columns to `lesson_plans`.
- [x] Add `teaching_method` support inside stage JSON; existing rows can keep fallback methods when read.
- [x] Add `model_call_logs` table without API keys.
- [x] Add store methods `addModelCallLog(log)` and `listModelCallLogs(limit)`.

### Task 4: Provider Observability And Fallback Reasons

**Files:**
- Create: `src/server/ai/observability.ts`
- Modify: `src/server/ai/provider.ts`
- Modify: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/index.ts`

- [x] Implement observability helpers from Task 1.
- [x] Update `generateAiStudentTurn` and `generateLessonPlan` to return `fallbackReason?: string`.
- [x] When provider config is missing or disabled, return clear fallback reasons.
- [x] When model call throws, preserve a safe Chinese failure summary.
- [x] In `/api/sessions/:id/turn`, persist a model call log for student turns and return `fallbackReason`.
- [x] In `/api/lesson-plans/generate`, persist a model call log for lesson planning and return `fallbackReason`.
- [x] Fix `providerConfigFromBody` so omitted `enabled` preserves the current provider setting instead of forcing `false`.
- [x] Add `GET /api/model-calls` returning recent sanitized logs.

### Task 5: Planner Dual Mode And Teaching Method Generation

**Files:**
- Modify: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/ai/prompts.ts`
- Modify: `src/client/api.ts`

- [x] Add default teaching methods for five phases:
  - 导入: `情境导入法`
  - 讲解: `支架式讲解`
  - 提问: `问题链教学`
  - 练习: `即时诊断与变式练习`
  - 总结: `归纳建构法`
- [x] Include `teachingMethod` in local fallback stages.
- [x] Include textbook fields in local overview when `planningMode === "textbook"`.
- [x] Update `buildLessonPlanPrompt` to request `teachingMethod` and to distinguish textbook planning from free-topic planning.
- [x] Update API response types to include `fallbackReason`.

### Task 6: Planner UI Upgrade

**Files:**
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Modify: `src/client/components/planner/LessonPlanPanel.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [x] Add a segmented control for `教材课时备课` and `自由主题微格备课`.
- [x] Show textbook fields only in textbook mode: 教材版本、册次、单元、课题、课时.
- [x] Add a visible AI status line after generation:
  - DeepSeek 成功: `DeepSeek 已生成`
  - Fallback: `已切换本地模拟：{fallbackReason}`
- [x] Add `教师教法` column between `教学目标` or `教师动作` and `教师动作`.
- [x] Add UI contract selectors: `.planner-mode-switch`, `.ai-generation-status`, `.lesson-stage-table--method`.
- [x] Keep no page-level horizontal overflow at 1366px width.

### Task 7: Verification

**Files:**
- No production edits unless verification finds a bug.

- [x] Run `npm run test:ai-observability`.
- [x] Run `npm run test:lesson-planner`.
- [x] Run `npm run test:provider`.
- [x] Run `npm run test:ui`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run check`.
- [x] In browser `http://localhost:5173/#planner`, verify both planning modes render, the stage table has `教师教法`, generation status explains model vs fallback, and the page does not horizontally overflow.

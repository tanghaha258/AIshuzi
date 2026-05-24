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
- [ ] Implementation has not started yet.

### Task 1: Observability Contract Test

**Files:**
- Create: `scripts/ai-observability-contract.ts`
- Modify: `package.json`

- [ ] Add `test:ai-observability` to `package.json` with command `tsx scripts/ai-observability-contract.ts`.
- [ ] Include the new script in `npm run check` after `test:provider`.
- [ ] Create a contract script that imports `createModelCallLog`, `sanitizeModelCallLog`, and `summarizeModelFailure` from `src/server/ai/observability.ts`.
- [ ] Assert `createModelCallLog` records `scenario`, `provider`, `model`, `baseURL`, `status`, `durationMs`, `usedModel`, and `fallbackReason`.
- [ ] Assert `sanitizeModelCallLog` never includes API keys or authorization headers.
- [ ] Assert `summarizeModelFailure(new Error("401 bad key"))` returns a Chinese message containing “鉴权” or “API Key”.
- [ ] Run `npm run test:ai-observability` and confirm it fails before implementation because `observability.ts` does not exist.

### Task 2: Planner Method Contract Test

**Files:**
- Modify: `scripts/lesson-planner-contract.ts`

- [ ] Extend the lesson planner contract to assert every local and normalized stage has `teachingMethod`.
- [ ] Assert local stages contain concrete methods such as “情境导入法”, “支架式讲解”, or “问题链教学”.
- [ ] Assert `normalizeLessonPlanResult` accepts model JSON with `teachingMethod` and fills missing methods from defaults.
- [ ] Assert `buildLocalLessonPlan` accepts `planningMode: "textbook"` plus textbook fields and includes textbook context in the overview.
- [ ] Run `npm run test:lesson-planner` and confirm it fails before implementation because `teachingMethod` and `planningMode` do not exist.

### Task 3: Shared Types And SQLite Migration

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`

- [ ] Add `PlanningMode = "free-topic" | "textbook"`.
- [ ] Extend `LessonPlanStage` with `teachingMethod: string`.
- [ ] Extend `GenerateLessonPlanPayload` with optional `planningMode`, `textbookVersion`, `volume`, `unit`, `lesson`, `课时`-equivalent `period`.
- [ ] Add `ModelCallLog` shared type with fields: `id`, `scenario`, `provider`, `model`, `baseURL`, `status`, `usedModel`, `fallbackReason`, `durationMs`, `createdAt`.
- [ ] Increase migration version to `4`.
- [ ] Add nullable `planning_mode`, `textbook_version`, `volume`, `unit`, `lesson`, `period` columns to `lesson_plans`.
- [ ] Add `teaching_method` support inside stage JSON; existing rows can keep fallback methods when read.
- [ ] Add `model_call_logs` table without API keys.
- [ ] Add store methods `addModelCallLog(log)` and `listModelCallLogs(limit)`.

### Task 4: Provider Observability And Fallback Reasons

**Files:**
- Create: `src/server/ai/observability.ts`
- Modify: `src/server/ai/provider.ts`
- Modify: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/index.ts`

- [ ] Implement observability helpers from Task 1.
- [ ] Update `generateAiStudentTurn` and `generateLessonPlan` to return `fallbackReason?: string`.
- [ ] When provider config is missing or disabled, return clear fallback reasons.
- [ ] When model call throws, preserve a safe Chinese failure summary.
- [ ] In `/api/sessions/:id/turn`, persist a model call log for student turns and return `fallbackReason`.
- [ ] In `/api/lesson-plans/generate`, persist a model call log for lesson planning and return `fallbackReason`.
- [ ] Fix `providerConfigFromBody` so omitted `enabled` preserves the current provider setting instead of forcing `false`.
- [ ] Add `GET /api/model-calls` returning recent sanitized logs.

### Task 5: Planner Dual Mode And Teaching Method Generation

**Files:**
- Modify: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/ai/prompts.ts`
- Modify: `src/client/api.ts`

- [ ] Add default teaching methods for five phases:
  - 导入: `情境导入法`
  - 讲解: `支架式讲解`
  - 提问: `问题链教学`
  - 练习: `即时诊断与变式练习`
  - 总结: `归纳建构法`
- [ ] Include `teachingMethod` in local fallback stages.
- [ ] Include textbook fields in local overview when `planningMode === "textbook"`.
- [ ] Update `buildLessonPlanPrompt` to request `teachingMethod` and to distinguish textbook planning from free-topic planning.
- [ ] Update API response types to include `fallbackReason`.

### Task 6: Planner UI Upgrade

**Files:**
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Modify: `src/client/components/planner/LessonPlanPanel.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [ ] Add a segmented control for `教材课时备课` and `自由主题微格备课`.
- [ ] Show textbook fields only in textbook mode: 教材版本、册次、单元、课题、课时.
- [ ] Add a visible AI status line after generation:
  - DeepSeek 成功: `DeepSeek 已生成`
  - Fallback: `已切换本地模拟：{fallbackReason}`
- [ ] Add `教师教法` column between `教学目标` or `教师动作` and `教师动作`.
- [ ] Add UI contract selectors: `.planner-mode-switch`, `.ai-generation-status`, `.lesson-stage-table--method`.
- [ ] Keep no page-level horizontal overflow at 1366px width.

### Task 7: Verification

**Files:**
- No production edits unless verification finds a bug.

- [ ] Run `npm run test:ai-observability`.
- [ ] Run `npm run test:lesson-planner`.
- [ ] Run `npm run test:provider`.
- [ ] Run `npm run test:ui`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run check`.
- [ ] In browser `http://localhost:5173/#planner`, verify both planning modes render, the stage table has `教师教法`, generation status explains model vs fallback, and the page does not horizontally overflow.

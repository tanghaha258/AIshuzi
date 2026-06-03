# P3 Lesson Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade course creation into an AI-assisted lesson planning flow that generates reusable micro-teaching scripts, classroom phases, incidents, and recommended AI student groups.

**Architecture:** Add a `LessonPlan` domain object persisted by SQLite and generated through a server service. The service first attempts the configured OpenAI-compatible provider, then falls back to a deterministic local planner so the product works without a DeepSeek key. The planner page becomes a practical two-step workflow: enter lesson basics, generate a script, review recommended students and incidents, then start a training session.

**Tech Stack:** TypeScript, Express, SQLite migrations, React, existing DeepSeek-ready provider abstraction, local deterministic fallback.

---

## Progress Update

Updated on 2026-05-24:

- [x] Created the P3 branch and implementation plan.
- [x] Added `test:lesson-planner` contract coverage and verified the RED state before implementation.
- [x] Added shared `LessonPlan` types, SQLite `lesson_plans` migration, and store persistence methods.
- [x] Implemented the lesson planner service with local fallback, model JSON normalization, stage generation, incident generation, and recommended AI student selection.
- [x] Added `POST /api/lesson-plans/generate` and `GET /api/courses/:id/lesson-plan`.
- [x] Upgraded the planner page with generated lesson script review, incident cards, recommended students, and direct entry into the training room.
- [x] Added responsive UI contract coverage for the planner layout.
- [x] Verified with `npm run check` and Playwright browser flow on `http://localhost:5173/#planner`.

### Task 1: Lesson Planner Contract Test

**Files:**
- Create: `scripts/lesson-planner-contract.ts`
- Modify: `package.json`

- [ ] Add `test:lesson-planner` to `package.json` with command `tsx scripts/lesson-planner-contract.ts`, and include it in `npm run check` after `test:agent-dialogue`.
- [ ] Create a contract script that imports `buildLocalLessonPlan`, `normalizeLessonPlanResult`, and `recommendStudentsForLesson` from `src/server/services/lessonPlanner.ts`.
- [ ] In the contract, create a Chinese math input:
  ```ts
  const input = {
    subject: "数学",
    grade: "八年级",
    topic: "勾股定理的生活化理解",
    objectives: "学生能够用生活例子解释直角三角形三边关系，并完成一次即时判断。",
    durationMinutes: 10
  };
  ```
- [ ] Assert `buildLocalLessonPlan(input, students)` returns a title containing the topic, five ordered stages named `导入`, `讲解`, `提问`, `练习`, `总结`, and total stage minutes equal to `durationMinutes`.
- [ ] Assert the local plan contains at least four planned incidents and at least four recommended student IDs.
- [ ] Assert `recommendStudentsForLesson(students, 6)` keeps a mixed classroom: at least one low-attention, one low-comprehension, one challenging, and one active student when those profiles exist.
- [ ] Assert `normalizeLessonPlanResult(raw, input, students)` repairs loose model JSON by clamping minutes, filling missing incident fields, and filtering unknown student IDs.
- [ ] Run `npm run test:lesson-planner` and confirm it fails before implementation because `lessonPlanner.ts` does not exist.

### Task 2: Shared Types And SQLite Persistence

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`

- [ ] Add shared types:
  ```ts
  export type LessonPlanStageType = "导入" | "讲解" | "提问" | "练习" | "总结";
  export type PlannedIncidentType = "听不懂" | "抢答" | "质疑" | "沉默" | "跑题";
  export interface LessonPlanStage {
    id: string;
    type: LessonPlanStageType;
    name: string;
    minutes: number;
    teacherAction: string;
    expectedStudentResponse: string;
    strategyTip: string;
  }
  export interface PlannedClassroomIncident {
    id: string;
    type: PlannedIncidentType;
    trigger: string;
    studentRole: string;
    teacherStrategy: string;
  }
  export interface LessonPlan {
    id: string;
    courseId: string;
    title: string;
    overview: string;
    objectives: string[];
    stages: LessonPlanStage[];
    incidents: PlannedClassroomIncident[];
    recommendedStudentIds: string[];
    generatedBy: "model" | "local";
    createdAt: string;
    updatedAt: string;
  }
  export interface GenerateLessonPlanPayload {
    title?: string;
    subject: string;
    grade: string;
    topic: string;
    objectives: string;
    durationMinutes: number;
  }
  ```
- [ ] Increase migration version to `3`.
- [ ] Add table `lesson_plans` with `id`, `course_id UNIQUE`, `title`, `overview`, `objectives`, `stages`, `incidents`, `recommended_student_ids`, `generated_by`, `created_at`, and `updated_at`.
- [ ] Add `rowToLessonPlan(row)` in `db.ts` using the existing JSON helper.
- [ ] Add store methods `getLessonPlan(courseId)`, `listLessonPlans()`, and `saveLessonPlan(input)`.
- [ ] Include `lessonPlans` in `DashboardData` so the client can refresh without losing generated scripts.

### Task 3: Lesson Planner Service

**Files:**
- Create: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/ai/prompts.ts`

- [ ] Implement `recommendStudentsForLesson(students, max)` by scoring students for classroom diversity: low attention, low comprehension, challenging profile, high participation, introverted profile, and careless profile.
- [ ] Implement `buildLocalLessonPlan(input, students)` with a deterministic five-stage script. The stage minute distribution must always add up to `durationMinutes`.
- [ ] Implement `normalizeLessonPlanResult(raw, input, students, generatedBy)` that returns a valid `LessonPlan`-like draft without `id/courseId/createdAt/updatedAt`, even when model JSON is incomplete.
- [ ] Implement `generateLessonPlan(config, input, students)` that calls `buildLessonPlanPrompt(input, students)` with JSON mode and returns `{ usedModel, planDraft }`; fallback to `buildLocalLessonPlan` on missing key or model failure.
- [ ] Update `buildLessonPlanPrompt` to request JSON with `overview`, `objectives`, `stages`, `incidents`, and `recommendedStudentIds`, and include available student profiles in the prompt.

### Task 4: Server API Integration

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/client/api.ts`

- [ ] Add `POST /api/lesson-plans/generate`.
- [ ] Validate required fields: `subject`, `grade`, `topic`, and `durationMinutes`; return `400` with clear Chinese messages when invalid.
- [ ] In the endpoint, create a course from the generated title/topic/objectives, generate a lesson plan through `generateLessonPlan`, save it with `store.saveLessonPlan`, and return `{ course, lessonPlan, recommendedStudents, usedModel }`.
- [ ] Add `GET /api/courses/:id/lesson-plan` returning the saved plan or `404`.
- [ ] Add `api.generateLessonPlan(payload)` and `api.getLessonPlan(courseId)` client methods.

### Task 5: Planner Page Experience

**Files:**
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Create: `src/client/components/planner/LessonPlanPanel.tsx`
- Modify: `src/client/styles.css`

- [ ] Replace the manual-only planner form with a combined form that supports `AI生成备课脚本` and `保存课程方案`.
- [ ] Show the generated lesson plan in `LessonPlanPanel` as a compact stage table: phase, minutes, teacher action, expected student response, and strategy tip.
- [ ] Show planned incidents as selectable chips/cards with trigger and teacher strategy.
- [ ] After generation, auto-select recommended student IDs while keeping the teacher able to adjust checkboxes.
- [ ] Add a primary action `用该脚本进入试讲室` that creates a session with the selected generated course and student group.
- [ ] Keep existing course list/session creation behavior for old saved courses.
- [ ] Add responsive CSS for `.lesson-plan-panel`, `.lesson-stage-table`, `.incident-grid`, `.generated-planner-grid`, and `.planner-actions`.

### Task 6: Verification

**Files:**
- No production edits unless verification finds a bug.

- [ ] Run `npm run test:lesson-planner`.
- [ ] Run `npm run test:agent-runtime`.
- [ ] Run `npm run test:agent-dialogue`.
- [ ] Run `npm run test:ui`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start the app and use the browser at `http://localhost:5173/#planner` to verify generating a lesson plan produces a visible stage table, planned incidents, and recommended students without layout overlap.

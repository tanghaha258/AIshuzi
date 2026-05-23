# P2 AI Student Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make configured AI students behave like persistent classroom agents with visible state bubbles, automatic state movement, and teacher-turn responses.

**Architecture:** Add a persistent `StudentRuntimeState` layer beside existing classroom events. The server updates runtime state on each teacher turn and lightweight tick, emits `student_state_change` events for the timeline, and the front end renders each student's current status bubble and pose from runtime state. DeepSeek-compatible generation remains behind the existing provider layer; no API key still uses local simulation.

**Tech Stack:** TypeScript, Express, SQLite migrations, React, SVG/CSS animation, existing OpenAI-compatible provider abstraction.

---

### Task 1: Runtime Contract Test

**Files:**
- Create: `scripts/agent-runtime-contract.ts`
- Modify: `package.json`

- [ ] Add a contract script using `tsx` that imports `createInitialRuntimeState`, `selectStudentsForTurn`, `applyStudentMessagesToRuntime`, and `advanceRuntimeTick` from `src/server/services/studentState.ts`.
- [ ] Assert initial state copies static student metrics and creates a visible `statusText`.
- [ ] Assert teacher text containing a student name prioritizes that student.
- [ ] Assert applying a student message updates `pose`, `statusText`, `lastSpokeAt`, and short memory.
- [ ] Assert tick changes at least one low-attention student's status without requiring a teacher turn.
- [ ] Run `npm run test:agent-runtime` and confirm it fails before implementation because the service does not exist.

### Task 2: Shared Types And SQLite State

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/db.ts`

- [ ] Add `StudentRuntimePose` and `StudentRuntimeState` to shared types.
- [ ] Add migration version 2 creating `student_runtime_states` with `session_id`, `student_id`, metrics, `pose`, `status_text`, `emotion`, `memory`, `last_spoke_at`, and `updated_at`.
- [ ] Add store methods `listRuntimeStates(sessionId)`, `ensureRuntimeStates(sessionId, students)`, and `upsertRuntimeState(state)`.
- [ ] Runtime state must survive refresh because it is saved in SQLite.

### Task 3: Student State Runtime

**Files:**
- Create: `src/server/services/studentState.ts`

- [ ] Implement `createInitialRuntimeState(sessionId, student)` with stable defaults.
- [ ] Implement `inferRuntimePose(text, student)` for listening, smiling, thinking, confused, distracted, and challenging.
- [ ] Implement `selectStudentsForTurn(students, states, teacherText, maxStudents)` to prioritize named students, challenged/low-comprehension students, and active participants.
- [ ] Implement `applyStudentMessagesToRuntime(states, messages, timestamp)` to update pose, metrics, status text, and memory.
- [ ] Implement `advanceRuntimeTick(states, students, timestamp)` to create passive movement such as走神、困惑、举手、等待.

### Task 4: Server API Integration

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/server/domain/simulation.ts`
- Modify: `src/server/ai/provider.ts`

- [ ] On `GET /api/sessions/:id`, include `runtimeStates`.
- [ ] On `POST /api/sessions/:id/turn`, ensure runtime states, select responding students, generate AI/local responses, persist updated states, and return `stateEvents` plus `runtimeStates`.
- [ ] Add `POST /api/sessions/:id/tick` to advance passive student state and return `stateEvents` plus `runtimeStates`.
- [ ] Include runtime metadata in student response events so reports and timeline can trace why a student reacted.

### Task 5: Front-End State Bubbles

**Files:**
- Modify: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/client/styles.css`

- [ ] Store active runtime states when opening a session.
- [ ] Render a speech/status bubble above each student portrait.
- [ ] Use runtime `pose` to drive existing student animation.
- [ ] Poll session tick every 7 seconds while the session is active.
- [ ] Update events, metrics, runtime states, and bubbles after each teacher turn.

### Task 6: Verification

**Files:**
- No production edits unless verification finds a bug.

- [ ] Run `npm run test:agent-runtime`.
- [ ] Run `npm run test:ui`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Use Chrome/Playwright screenshot on `http://localhost:5173/#training` to verify bubbles are visible and students keep layout stability.

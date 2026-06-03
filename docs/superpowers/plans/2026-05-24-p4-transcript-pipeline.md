# P4 Transcript Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers run a real microphone-driven trial lesson, persist speech transcript segments, and use final transcript text to drive AI student responses.

**Architecture:** Keep audio processing browser-local for the web version. `useSpeechRecognition` becomes a continuous segment producer with interim/final results; `useTranscriptBuffer` turns recognition callbacks into stable transcript segments; the server persists transcript segments as `ClassroomEvent` records with metadata. The training room shows live interim text, saved transcript history, clear permission/fallback state, and sends final transcript text through the existing AI student turn pipeline with `inputMode: "speech"`.

**Tech Stack:** TypeScript, React hooks, Web Speech API, Express, SQLite event persistence, existing classroom event timeline.

---

## Progress Update

Updated on 2026-05-24:

- [x] Continued from P3.5 branch so DeepSeek observability and planner upgrades are preserved.
- [x] Created branch `codex/p4-transcript-pipeline-v2`.
- [x] Baseline `npm run check` passed before P4 work.
- [x] Added `test:transcript` contract and included it in `npm run check`.
- [x] Implemented transcript shared types and `src/server/services/transcriptService.ts`.
- [x] Added `POST /api/sessions/:id/transcripts`, transcript event persistence, duplicate transcript-id protection, and speech turn triggering through the existing AI student pipeline.
- [x] Reworked browser speech recognition to continuous Web Speech mode with interim and final segments.
- [x] Added `useTranscriptBuffer` and the training-room transcript UI: live interim text, final segment list, status pill, clear, and send-as-turn.
- [x] Updated smoke check to verify transcript persistence and transcript-triggered student response.
- [x] Verified Training Room UI at `http://localhost:5173/#training` in Chrome/Playwright at 1366x900.

### Task 1: Transcript Contract Test

**Files:**
- Create: `scripts/transcript-contract.ts`
- Modify: `package.json`

- [x] Add `test:transcript` to `package.json` with command `tsx scripts/transcript-contract.ts`.
- [x] Include `npm run test:transcript` in `npm run check` after `test:lesson-planner`.
- [x] Create a contract script importing `normalizeTranscriptSegment`, `createTranscriptEvent`, and `mergeTranscriptSegments` from `src/server/services/transcriptService.ts`.
- [x] Test that `normalizeTranscriptSegment` trims text, rejects empty final text, clamps confidence to `0..1`, preserves `source: "web-speech"`, and stores `startOffsetMs/endOffsetMs`.
- [x] Test that `createTranscriptEvent("session-1", segment)` returns a `transcript_segment` event whose metadata includes `isFinal`, `source`, `confidence`, `startOffsetMs`, and `endOffsetMs`.
- [x] Test that `mergeTranscriptSegments` combines consecutive final segments into a turn text, but ignores interim segments.
- [x] Run `npm run test:transcript` and confirm it fails before implementation because `transcriptService.ts` does not exist.

### Task 2: Shared Transcript Types And Server Service

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/server/services/transcriptService.ts`

- [x] Add `TranscriptSource`, `TranscriptSegment`, and `TranscriptTurnPayload`.
- [x] Implement `normalizeTranscriptSegment(input)` with safe defaults and validation.
- [x] Implement `createTranscriptEvent(sessionId, segment)` returning `Omit<ClassroomEvent, "id" | "timestamp">`.
- [x] Implement `mergeTranscriptSegments(segments)` returning final text joined by spaces.
- [x] Keep raw audio out of the server API; only text and timing metadata are persisted.

### Task 3: Transcript API Integration

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/client/api.ts`

- [x] Add `POST /api/sessions/:id/transcripts`.
- [x] Validate the session exists; return `404` with `Session not found` if missing.
- [x] Normalize each incoming segment and save transcript events using `store.addEvent`.
- [x] If `sendAsTurn` is true and merged final text is non-empty, run the same AI student turn pipeline as `/turn` with `inputMode: "speech"`.
- [x] Return `{ transcriptEvents, turnResult? }`.
- [x] Add `api.saveTranscriptSegments(sessionId, payload)` on the client.

### Task 4: Continuous Speech Recognition Hook

**Files:**
- Modify: `src/client/hooks/useSpeechRecognition.ts`
- Create: `src/client/hooks/useTranscriptBuffer.ts`

- [x] Change recognition settings to `continuous = true` and `interimResults = true`.
- [x] Emit segment callbacks with `{ text, isFinal, confidence, startOffsetMs, endOffsetMs, source: "web-speech", language: "zh-CN" }`.
- [x] Track statuses: `"idle" | "listening" | "unsupported" | "blocked" | "error"`.
- [x] Auto-restart recognition after `onend` only when the user is still in listening mode.
- [x] Build `useTranscriptBuffer` to keep `interimText`, `finalSegments`, `lastError`, `flushFinalSegments()`, and `clearTranscript()`.
- [x] Keep manual input fallback available when speech is unsupported or blocked.

### Task 5: Training Room Transcript UI

**Files:**
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/client/styles.css`
- Modify: `scripts/ui-contract.mjs`

- [x] Replace one-shot speech behavior with continuous listening controls: start, stop, clear transcript, and send transcript as classroom turn.
- [x] Show a compact transcript panel below the teacher input with live interim text and the last three final segments.
- [x] When final segments arrive, save them through `/api/sessions/:id/transcripts`.
- [x] When the teacher clicks send from speech, call the transcript API with `sendAsTurn: true`; append returned transcript events and AI turn events to the page state.
- [x] Add CSS selectors to the UI contract: `.transcript-panel`, `.transcript-panel__live`, `.transcript-segment-list`, `.speech-status-pill`, `.transcript-actions`.
- [x] Ensure camera/microphone permission failures do not break manual teaching input.

### Task 6: Verification

**Files:**
- No production edits unless verification finds a bug.

- [x] Run `npm run test:transcript`.
- [x] Run `npm run test:ui`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build:server`.
- [x] Run `npm run smoke`.
- [x] Use Chrome/Playwright at `http://localhost:5173/#training` to verify speech controls render.
- [x] Run final `npm run check`.

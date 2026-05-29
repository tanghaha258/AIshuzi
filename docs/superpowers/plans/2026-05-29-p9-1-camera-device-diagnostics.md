# P9.1 Camera Device Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-device camera selection, permission diagnostics, and richer teacher-observation state for P9.1.

**Architecture:** Keep browser media ownership in `useCamera`, orchestration in `TrainingRoom`, and observation display logic in `TeacherObservationPanel`. Reuse the existing MediaPipe metric payload and backend save flow so no image or video data leaves the browser.

**Tech Stack:** React 19, TypeScript, Vite, browser MediaDevices API, existing Node/tsx contract scripts.

---

### Task 1: Camera Hook Device Selection And Diagnostics

**Files:**
- Modify: `scripts/camera-hook-contract.mjs`
- Modify: `src/client/hooks/useCamera.ts`

- [ ] **Step 1: Extend the contract test**

Add assertions that `useCamera` exposes video input devices, selected device switching, `enumerateDevices`, exact `deviceId` constraints, stream cleanup, and normalized failure reasons.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:camera-hook`

Expected: FAIL because the hook has no device list, selected device state, refresh function, or diagnostic reason yet.

- [ ] **Step 3: Implement the hook**

Add `CameraDevice`, `CameraFailureReason`, and `CameraStatus` types. Track `devices`, `selectedDeviceId`, `failureReason`, and `permissionGranted`. Enumerate `videoinput` devices before and after permission. Request the selected camera using `{ deviceId: { exact: selectedDeviceId } }` when a selection exists. Stop the previous stream on cleanup and when switching devices.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:camera-hook`

Expected: PASS.

### Task 2: Training Room Camera Controls And Save State

**Files:**
- Modify: `scripts/ui-contract.mjs`
- Modify: `src/client/components/TrainingRoom.tsx`

- [ ] **Step 1: Extend the UI contract**

Add source assertions for camera device controls, camera diagnostics, observation save-state tracking, and the `TeacherObservationPanel` props.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:ui`

Expected: FAIL because the training room has no selector, diagnostic copy, or observation save-state prop yet.

- [ ] **Step 3: Implement TrainingRoom changes**

Read new fields from `useCamera`. Render a camera device `<select>` in the camera card. Disable it when no device is available. Show specific diagnostic copy for blocked states. Maintain `observationSaveState` and `lastObservationSavedAt` around `api.saveTeacherObservation`.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:ui`

Expected: PASS.

### Task 3: Observation Panel Metadata And Calibration

**Files:**
- Modify: `scripts/ui-contract.mjs`
- Modify: `src/client/components/training/TeacherObservationPanel.tsx`
- Modify: `src/client/styles.css`

- [ ] **Step 1: Extend the UI contract**

Add required CSS selectors for observation metadata, calibration, and camera diagnostics. Add source assertions that the observation panel includes confidence, sampling time, and save status labels.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test:ui`

Expected: FAIL until the component and CSS expose the new selectors and copy.

- [ ] **Step 3: Implement panel and CSS**

Add `observationSaveState` and `lastObservationSavedAt` props. Derive calibration from the current payload. Render sampling time, confidence, and save status in a compact metadata row. Add CSS selectors with stable dimensions.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm run test:ui`

Expected: PASS.

### Task 4: Full Verification

**Files:**
- Verify: `package.json` scripts

- [ ] **Step 1: Run focused contracts**

Run: `npm run test:camera-hook && npm run test:teacher-vision-hook && npm run test:ui`

Expected: all commands exit 0.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 4: Inspect git diff**

Run: `git diff --stat`

Expected: only P9.1 docs, hook, training room, panel, CSS, and contract scripts changed.

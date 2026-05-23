# Training Room Stage Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the training room into a usable classroom command console with a visible 2.5D AI student stage instead of small avatar cards.

**Architecture:** Keep the existing React/Vite front end and current session/event API. The change is front-end focused: `TrainingRoom.tsx` continues to own session behavior, `StudentPortrait.tsx` renders a richer full-body student, and `styles.css` defines a complete responsive cockpit layout. A small contract script guards against the missing-class regression that created the blank center area.

**Tech Stack:** React, TypeScript, CSS Grid/Flexbox, SVG-based 2.5D character art, Node script contract checks, Vite build.

---

### Task 1: Add Layout Contract Check

**Files:**
- Create: `scripts/ui-contract.mjs`
- Modify: `package.json`

- [ ] Add a Node script that reads `src/client/styles.css` and verifies the training-room classes used by `TrainingRoom.tsx` have corresponding style rules.
- [ ] Include the key classes: `.training-grid`, `.teacher-column`, `.student-stage`, `.student-stage__grid`, `.student-stage__summary`, `.insight-rail`, `.student-agent-card--portrait`, `.student-portrait`, `.student-portrait__body`, `.student-portrait__desk`.
- [ ] Run `node scripts/ui-contract.mjs` and confirm it fails before implementation because the current stylesheet is missing several rules.
- [ ] Add `test:ui` to `package.json` and include it in `npm run check`.

### Task 2: Rebuild Training Room Layout

**Files:**
- Modify: `src/client/styles.css`

- [ ] Define `.training-grid` as a three-column console: teacher controls, student stage, insight rail.
- [ ] Keep cards compact and dark in the training room, with stable heights so the student stage does not push the page into a blank scroll area.
- [ ] Make the layout responsive at notebook widths by collapsing to one column while preserving content order.
- [ ] Run `node scripts/ui-contract.mjs` and confirm the layout contract now passes.

### Task 3: Upgrade AI Student Visuals

**Files:**
- Modify: `src/client/components/training/StudentPortrait.tsx`
- Modify: `src/client/styles.css`

- [ ] Replace the head-card portrait with a taller 2.5D full-body classroom character: head, torso, arms, desk, nameplate, and pose indicators.
- [ ] Map poses to visible movement states: listening, smiling, thinking, confused, distracted, challenging.
- [ ] Add CSS animation hooks for hand raise, thinking, distraction, and challenge states.
- [ ] Ensure portrait dimensions are stable so six students fit in the stage without overflowing.

### Task 4: Polish the Training Room Composition

**Files:**
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/client/styles.css`

- [ ] Make the student stage the visual center of the page.
- [ ] Move classroom pulse, radar, suggestion, and timeline into a right-side insight rail on wide screens.
- [ ] Keep teacher camera, lesson slide, and speech input grouped as a practical teaching control column.
- [ ] Preserve existing API calls and event behavior.

### Task 5: Verify

**Files:**
- No production files unless verification reveals a bug.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:ui`.
- [ ] Reload `http://localhost:5173/#training` in the in-app browser and take a screenshot.
- [ ] Check desktop viewport for: no blank center column, visible 2.5D student bodies, stable right rail, no obvious overlap.

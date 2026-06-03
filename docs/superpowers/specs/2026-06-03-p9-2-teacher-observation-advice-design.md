# P9.2 Teacher Observation Advice Design

## Goal

P9.2 turns teacher-camera observation metrics into real-time teaching advice. The camera pipeline should no longer only say whether the picture is usable; it should help the teacher decide what to do in the next few seconds of the micro-teaching session.

The first version focuses on the live training room suggestion area. Advice should be concrete, short, and teacher-facing, while preserving the existing privacy boundary: no photos, video, frames, landmarks, or device identifiers are saved.

## Scope

This increment covers:

- Map existing `TeacherObservationPayload` metrics to immediate teacher actions.
- Replace device-first camera suggestions with teaching-facing guidance in `system_suggestion` events.
- Prioritize the most important observation issue when several metrics are weak.
- Avoid repeated camera advice flooding the live suggestion area.
- Keep observation advice in the existing event stream so it appears in the training room, timeline, and reports.

This increment does not add new MediaPipe landmarks, distance estimation, or model-generated advice. It does not change how camera streams are captured, and it does not save any camera media.

## Advice Principles

Advice should answer: "What should the teacher do next?"

Examples:

- Low confidence or no face: "先回到镜头中央并补足光线，后续观察建议才会更可靠。"
- Looking down: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。"
- Looking left or right: "讲解时把身体和视线转回学生区，减少长时间偏离镜头。"
- Low stability: "先固定站位或设备，再继续讲解，避免观察数据失真。"
- Low expression activity: "讲到关键概念时加入一次停顿、重音或手势强调。"
- Healthy observation: no new suggestion event, so the UI is not noisy.

The copy should avoid blaming the teacher. It should sound like a coach giving the next actionable move.

## Architecture

`src/server/services/observationService.ts` remains the single server-side boundary for turning observation metrics into events. It already normalizes metrics and creates both a `teacher_observation` event and an optional `system_suggestion` event.

P9.2 extends this service with a small advice classifier:

- `classifyTeacherObservationAdvice(observation)` returns a priority, label, and action.
- `buildSuggestionContent(observation)` uses the classifier to produce teacher-facing advice copy.
- The returned `system_suggestion` event still uses `metadata.source = "teacher_observation"` and includes the numeric observation payload.

`TrainingRoom` can keep using the current `latestSuggestion` logic because observation advice remains a normal `system_suggestion`. If the existing UI needs a small affordance, it should be limited to copy or metadata display, not a new channel.

## Priority Rules

When multiple issues are present, use this order:

1. **Observation reliability:** `faceVisible === false` or `faceConfidence < 35`
   - Reason: the system cannot make reliable teaching judgments until the teacher is visible.
2. **Teacher gaze / orientation:** `headDirection === "down"`
   - Reason: low head direction is the clearest teaching-behavior signal and should produce a teaching move.
3. **Teacher orientation:** `headDirection === "left" | "right" | "up"`
   - Reason: the teacher may be addressing material or moving away from the class-facing stance.
4. **Stability:** `stability < 35`
   - Reason: unstable video makes both observation and teacher presence harder to read.
5. **Expression activity:** `expressionActivity < 25` with reliable face confidence
   - Reason: this is softer than gaze and stability, so it should not override higher-confidence issues.

If none of these rules match, no `system_suggestion` should be emitted from camera observation.

## Dedupe And Noise Control

The current service is stateless, so P9.2 should implement the first useful dedupe layer without introducing server memory:

- Keep one suggestion per saved observation request.
- Make each suggestion focus on the top-priority issue only.
- Do not concatenate several camera tips in one event.

If repeated advice still feels noisy during real camera testing, a later P9.2 follow-up can pass recent events into the service and suppress the same advice label for a short window. That later suppression should use existing classroom events, not process-wide memory.

## Data Flow

1. Browser camera and MediaPipe produce local numeric observation metrics.
2. `TrainingRoom` posts the metric payload to `POST /api/sessions/:id/teacher-observation`.
3. `observationService` normalizes and stores a `teacher_observation` event.
4. The advice classifier chooses the highest-priority teaching action, if any.
5. The server returns an optional `system_suggestion` event.
6. `TrainingRoom` shows it in the existing "即时教学建议" panel and appends it to the timeline.
7. Reports and training targets can reuse the suggestion as normal event evidence.

## Testing

Contract tests should cover:

- No face / low confidence produces advice about returning to the center and making observation reliable.
- Looking down produces advice about looking toward students before the next question.
- Side/up direction produces advice about turning attention back to the student area.
- Low stability produces advice about fixing stand/device before continuing.
- Low expression activity produces advice about pause, emphasis, gesture, or tone.
- Healthy observation produces no suggestion event.
- When multiple issues appear, only the highest-priority advice is emitted.

UI contract should only be extended if the training room needs a visible metadata marker. The preferred path is to reuse the existing `system_suggestion` panel.

## Privacy Boundary

P9.2 keeps the same privacy boundary as P9.1 and P9.3. The advice engine only receives numeric `TeacherObservationPayload` fields and writes numeric metrics plus text advice into events. It never stores camera frames, face images, video, raw landmarks, or camera device identifiers.

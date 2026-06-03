# P10.1 Report Retraining Template Design

## Goal

P10.1 turns a课后报告建议 into a structured retraining template. When a teacher clicks "用此建议复训", the next training session should explain not only what to improve, but how to rehearse it in the next micro-teaching round.

The template should lean toward teacher action: concrete steps, success criteria, evidence prompts, and focus metrics. It should reuse existing report evidence and camera-observation summaries without saving any photos, video, or raw media.

## Scope

This increment covers:

- Extend `TrainingTarget` with a deterministic `template` object.
- Generate the template from the selected report recommendation, report metrics, evidence event IDs, and teacher-camera observation summary when available.
- Persist the template with the training target so it survives reloads and historical reports.
- Show the template in the training room target banner and "即时教学建议" panel.
- Keep the existing report-to-training-target flow and completion status behavior.

This increment does not add an AI template generator, a reusable template library, custom teacher editing, or cross-report analytics. Those can come after the deterministic loop is stable.

## Template Shape

`TrainingTarget.template` should use a compact shape:

```ts
export type TrainingTargetTemplateType =
  | "concept-check"
  | "strategy-follow-up"
  | "participation-recovery"
  | "camera-presence";

export interface TrainingTargetTemplate {
  type: TrainingTargetTemplateType;
  title: string;
  scenario: string;
  steps: string[];
  successCriteria: string[];
  evidencePrompts: string[];
  focusMetrics: string[];
}
```

The field is required for newly created targets. Row parsing should tolerate missing or invalid JSON by returning a safe fallback template built from the existing recommendation fields.

## Template Classification

The first version should be deterministic and readable:

1. If the recommendation title/detail/action mentions camera-observation language such as `镜头`, `摄像头`, `抬头`, `视线`, `站位`, or the report contains teacher-observation issues, classify as `camera-presence`.
2. If the title/action mentions `低参与`, `参与`, `点名`, or `补充理由`, classify as `participation-recovery`.
3. If the title/action mentions `即时建议`, `策略`, or `观察点`, classify as `strategy-follow-up`.
4. Otherwise classify as `concept-check`.

`camera-presence` should be selected for teacher-camera recommendations even if the report also contains confusion evidence. That keeps P9.2/P9.3 data moving toward teacher coaching.

## Template Content

Every generated template should include:

- A scenario sentence that names the selected recommendation.
- Three practice steps.
- Three success criteria.
- At least two evidence prompts.
- Three focus metrics.

Copy should be short, coach-like, and suitable for a live training room. Examples:

- `concept-check`: "讲完一个关键步骤后停顿 3 秒，请一名学生复述设量和等量关系。"
- `strategy-follow-up`: "选择一条即时建议，先说出采纳动作，再观察学生回应是否变化。"
- `participation-recovery`: "先请低参与学生回答一个可完成小步，再请积极学生补充理由。"
- `camera-presence`: "下一轮提问前先抬头看向学生区，再请一名学生复述关键步骤。"

## Data Flow

1. Reports page posts `reportId` and `recommendationTitle` to the existing training-target endpoint.
2. `store.createTrainingTargetFromRecommendation()` loads the report and selected recommendation.
3. A local helper builds `TrainingTargetTemplate` from the recommendation and report context.
4. The target persists `template` as JSON in `training_targets.template`.
5. `GET /api/sessions/:id` returns the target with its template.
6. `TrainingRoom` renders the template next to the live suggestion and target banner.
7. Completing the session still marks the target as `completed`.

## UI Behavior

The training room should show:

- Target banner: selected recommendation plus a compact template title/scenario.
- Suggestion panel: existing action plus a "复训任务清单" area with steps, criteria, evidence prompts, and focus metrics.

The UI should remain dense and operational, not a landing-page explanation. It should use existing card/panel styling and avoid nested cards.

## Privacy Boundary

P10.1 does not store media. It stores only existing report text, evidence IDs, metrics, and teacher-observation aggregate labels already present in the report.

## Testing

Contract tests should prove:

- A training target created from a concept/confusion recommendation includes a `concept-check` template with steps, criteria, prompts, and focus metrics.
- A camera-related report recommendation creates a `camera-presence` template.
- The persisted target returns the same template after `getTrainingTargetBySession()`.
- Completing the retraining session keeps status behavior unchanged.
- Historical reports can still create targets after the original course row is deleted.

The UI contract should prove:

- `TrainingRoom` renders template steps, criteria, prompts, and metrics using stable selectors.
- CSS contains selectors for the new training-target template area.

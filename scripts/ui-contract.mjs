import { readFileSync } from "node:fs";

const css = readFileSync("src/client/styles.css", "utf8");
const plannerSource = readFileSync("src/client/components/CoursePlannerPage.tsx", "utf8");
const trainingRoomSource = readFileSync("src/client/components/TrainingRoom.tsx", "utf8");
const teacherObservationPanelSource = readFileSync("src/client/components/training/TeacherObservationPanel.tsx", "utf8");

const requiredTrainingRoomSelectors = [
  ".training-grid",
  ".teacher-column",
  ".training-header--wide",
  ".student-stage",
  ".student-stage__summary",
  ".student-stage__grid",
  ".student-stage__deck",
  ".insight-rail",
  ".teacher-feedback-stack",
  ".timeline-panel--wide",
  ".timeline-table",
  ".timeline-table__content",
  ".timeline-status",
  ".student-agent-card--portrait",
  ".student-agent-card__body",
  ".student-agent-card__metrics",
  ".student-agent-card__memory",
  ".student-dialogue",
  ".student-live-status",
  ".student-portrait",
  ".student-portrait__body",
  ".student-portrait__desk",
  ".transcript-panel",
  ".transcript-panel__live",
  ".transcript-segment-list",
  ".speech-status-pill",
  ".transcript-actions",
  ".teacher-observation-panel",
  ".teacher-observation-grid",
  ".teacher-observation-status",
  ".teacher-observation-calibration",
  ".teacher-observation-meta",
  ".camera-device-control",
  ".camera-diagnostic",
  ".training-target-banner",
  ".training-target-focus",
  ".process-evidence-panel",
  ".process-evidence-type-grid",
  ".process-evidence-student-select",
  ".process-evidence-note",
  ".process-evidence-list",
  ".process-evidence-card"
];

const missing = requiredTrainingRoomSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

const requiredPlannerSelectors = [
  ".generated-planner-grid",
  ".planner-mode-switch",
  ".ai-generation-status",
  ".lesson-plan-panel",
  ".lesson-plan-panel__header",
  ".lesson-stage-table",
  ".lesson-stage-table--method",
  ".lesson-stage-table--script",
  ".lesson-stage-table--evaluation",
  ".planner-example-button",
  ".process-evaluation-fields",
  ".process-evaluation-summary",
  ".incident-grid",
  ".incident-card",
  ".planner-actions"
];

const requiredSettingsSelectors = [
  ".model-call-log-list",
  ".model-call-log",
  ".model-call-status",
  ".model-call-status--success",
  ".model-call-status--fallback",
  ".model-call-empty"
];

const requiredReportSelectors = [
  ".report-list-toolbar",
  ".report-card__actions",
  ".report-detail-grid",
  ".report-source-pill",
  ".report-overview-strip",
  ".report-evidence-list",
  ".report-evidence-node",
  ".evidence-drilldown-button",
  ".report-evidence-context",
  ".report-context-event",
  ".report-context-event--target",
  ".report-recommendation-list",
  ".report-recommendation-card",
  ".report-process-evaluation",
  ".training-target-button",
  ".report-timeline-table",
  ".report-student-diagnosis",
  ".report-strategy-list",
  ".report-export-panel",
  ".delete-report-button"
];

const requiredListManagementSelectors = [
  ".list-toolbar",
  ".search-input",
  ".pagination-controls",
  ".course-card__actions",
  ".course-card__topline",
  ".delete-course-button",
  ".session-list",
  ".session-card",
  ".session-card__actions",
  ".delete-session-button",
  ".planner-list-panel",
  ".select-card-row",
  ".delete-setup-course-button",
  ".bounded-list"
];

const missingPlannerSelectors = requiredPlannerSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

if (missingPlannerSelectors.length) {
  console.error("Missing planner CSS selectors:");
  for (const selector of missingPlannerSelectors) {
    console.error(`- ${selector}`);
  }
  process.exit(1);
}

const missingSettingsSelectors = requiredSettingsSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

if (missingSettingsSelectors.length) {
  console.error("Missing settings CSS selectors:");
  for (const selector of missingSettingsSelectors) {
    console.error(`- ${selector}`);
  }
  process.exit(1);
}

const missingReportSelectors = requiredReportSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

if (missingReportSelectors.length) {
  console.error("Missing report CSS selectors:");
  for (const selector of missingReportSelectors) {
    console.error(`- ${selector}`);
  }
  process.exit(1);
}

const missingListManagementSelectors = requiredListManagementSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

if (missingListManagementSelectors.length) {
  console.error("Missing list-management CSS selectors:");
  for (const selector of missingListManagementSelectors) {
    console.error(`- ${selector}`);
  }
  process.exit(1);
}

if (missing.length) {
  console.error("Missing training-room CSS selectors:");
  for (const selector of missing) {
    console.error(`- ${selector}`);
  }
  process.exit(1);
}

const layoutAssertions = [
  {
    name: "training-grid uses named areas",
    ok: /\.training-grid\s*{[^}]*grid-template-areas/s.test(css)
  },
  {
    name: "student stage owns the primary stage area",
    ok: /\.student-stage\s*{[^}]*grid-area:\s*stage/s.test(css)
  },
  {
    name: "timeline owns its dedicated bottom area",
    ok: /\.timeline-panel--wide\s*{[^}]*grid-area:\s*timeline/s.test(css)
  },
  {
    name: "student deck uses responsive auto-fit cards",
    ok: /\.student-stage__deck\s*{[^}]*auto-fit/s.test(css)
  },
  {
    name: "teacher column is a scrollable feedback stack",
    ok: /\.teacher-column\s*{[^}]*overflow:\s*auto/s.test(css)
  },
  {
    name: "planner incident grid uses responsive auto-fit cards",
    ok: /\.incident-grid\s*{[^}]*auto-fit/s.test(css)
  },
  {
    name: "generated planner gives the script panel room after a compact fixed form column",
    ok: /\.generated-planner-grid\s*{[^}]*grid-template-columns:\s*minmax\(300px,\s*360px\)\s+minmax\(0,\s*1fr\)/s.test(css)
  },
  {
    name: "lesson script table scrolls inside the panel instead of clipping the page",
    ok: /\.lesson-plan-panel\s*{[^}]*overflow:\s*hidden/s.test(css) && /\.lesson-stage-table\s*{[^}]*overflow-x:\s*auto/s.test(css)
  },
  {
    name: "planner defaults are empty and example content is opt-in",
    ok: /const emptyDraft[\s\S]*subject:\s*""[\s\S]*grade:\s*""[\s\S]*topic:\s*""/.test(plannerSource)
      && /const exampleDraft[\s\S]*勾股定理的生活化理解/.test(plannerSource)
      && /planner-example-button/.test(plannerSource)
  },
  {
    name: "dashboard grid does not stretch side panels to match long lists",
    ok: /\.dashboard-grid\s*{[^}]*align-items:\s*start/s.test(css)
  },
  {
    name: "course cards keep actions pinned to the bottom",
    ok: /\.course-card__actions\s*{[^}]*margin-top:\s*auto/s.test(css)
  },
  {
    name: "planner list panel avoids vertically stretched selection cards",
    ok: /\.planner-list-panel\s*{[^}]*align-items:\s*start/s.test(css)
  },
  {
    name: "training room records process-evaluation evidence through the API",
    ok: /api\.recordProcessEvidence/.test(trainingRoomSource)
  },
  {
    name: "training room exposes camera device selection and diagnostics",
    ok: /devices\.map/.test(trainingRoomSource)
      && /selectedDeviceId/.test(trainingRoomSource)
      && /setSelectedDeviceId/.test(trainingRoomSource)
      && /cameraFailureMessage/.test(trainingRoomSource)
      && /camera-device-control/.test(trainingRoomSource)
      && /camera-diagnostic/.test(trainingRoomSource)
  },
  {
    name: "training room tracks teacher observation save state",
    ok: /observationSaveState/.test(trainingRoomSource)
      && /lastObservationSavedAt/.test(trainingRoomSource)
      && /setObservationSaveState\("saving"\)/.test(trainingRoomSource)
      && /setObservationSaveState\("saved"\)/.test(trainingRoomSource)
      && /setObservationSaveState\("error"\)/.test(trainingRoomSource)
  },
  {
    name: "teacher observation panel shows calibration, sampling time, confidence, and save state",
    ok: /calibrationLabel/.test(teacherObservationPanelSource)
      && /sampleTimeLabel/.test(teacherObservationPanelSource)
      && /saveStateLabel/.test(teacherObservationPanelSource)
      && /faceConfidence/.test(teacherObservationPanelSource)
      && /teacher-observation-calibration/.test(teacherObservationPanelSource)
      && /teacher-observation-meta/.test(teacherObservationPanelSource)
  }
];

const failedLayouts = layoutAssertions.filter((assertion) => !assertion.ok);
if (failedLayouts.length) {
  console.error("Training-room layout contract failed:");
  for (const assertion of failedLayouts) {
    console.error(`- ${assertion.name}`);
  }
  process.exit(1);
}

console.log(`UI contract passed (${requiredTrainingRoomSelectors.length + requiredPlannerSelectors.length + requiredSettingsSelectors.length + requiredReportSelectors.length + requiredListManagementSelectors.length} selectors).`);

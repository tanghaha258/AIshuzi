import { readFileSync } from "node:fs";

const css = readFileSync("src/client/styles.css", "utf8");

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
  ".student-portrait__desk"
];

const missing = requiredTrainingRoomSelectors.filter((selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`${escaped}(?:[\\s,.:{#]|$)`).test(css);
});

const requiredPlannerSelectors = [
  ".generated-planner-grid",
  ".lesson-plan-panel",
  ".lesson-plan-panel__header",
  ".lesson-stage-table",
  ".incident-grid",
  ".incident-card",
  ".planner-actions"
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

console.log(`UI contract passed (${requiredTrainingRoomSelectors.length + requiredPlannerSelectors.length} selectors).`);

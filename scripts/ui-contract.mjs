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
    name: "student deck uses responsive auto-fit cards",
    ok: /\.student-stage__deck\s*{[^}]*auto-fit/s.test(css)
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

console.log(`Training-room UI contract passed (${requiredTrainingRoomSelectors.length} selectors).`);

import { readFileSync } from "node:fs";

const css = readFileSync("src/client/styles.css", "utf8");

const requiredTrainingRoomSelectors = [
  ".training-grid",
  ".teacher-column",
  ".training-header--wide",
  ".student-stage",
  ".student-stage__summary",
  ".student-stage__grid",
  ".insight-rail",
  ".student-agent-card--portrait",
  ".student-agent-card__body",
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

console.log(`Training-room UI contract passed (${requiredTrainingRoomSelectors.length} selectors).`);

import assert from "node:assert/strict";
import { shouldSendTeacherTurnFromKey } from "../src/client/utils/teacherInput";

assert.equal(
  shouldSendTeacherTurnFromKey({ key: "Enter", shiftKey: false, isComposing: false }),
  true,
  "Enter should submit the manual classroom turn"
);

assert.equal(
  shouldSendTeacherTurnFromKey({ key: "Enter", shiftKey: true, isComposing: false }),
  false,
  "Shift+Enter should keep the newline behavior"
);

assert.equal(
  shouldSendTeacherTurnFromKey({ key: "a", shiftKey: false, isComposing: false }),
  false,
  "Other keys should not submit the classroom turn"
);

assert.equal(
  shouldSendTeacherTurnFromKey({ key: "Enter", shiftKey: false, isComposing: true }),
  false,
  "IME composition Enter should not submit while the user is still choosing characters"
);

console.log("Training input keyboard contract passed.");

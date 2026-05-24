import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/client/hooks/useTeacherVision.ts", "utf8");

assert.match(source, /try\s*{\s*const observation = deriveTeacherObservation/s);
assert.match(source, /catch \(cause\)/);
assert.match(source, /setStatus\("error"\)/);
assert.match(source, /window\.clearInterval\(intervalId\)/);
assert.match(source, /let samplingFailed = false/);
assert.match(source, /if \(!samplingFailed\)/);

console.log("Teacher vision hook failure contract passed.");

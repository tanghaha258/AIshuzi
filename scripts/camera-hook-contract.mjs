import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/client/hooks/useCamera.ts", "utf8");

assert.match(source, /const streamRef = useRef<MediaStream \| undefined>\(undefined\)/);
assert.match(source, /streamRef\.current = mediaStream/);
assert.match(source, /videoRef\.current\.srcObject = streamRef\.current/);
assert.match(source, /\[status\]/);
assert.match(source, /let cancelled = false/);
assert.match(source, /if \(cancelled\)/);
assert.match(source, /cancelled = true/);
assert.match(source, /!navigator\.mediaDevices\?\.getUserMedia/);

console.log("Camera hook attachment contract passed.");

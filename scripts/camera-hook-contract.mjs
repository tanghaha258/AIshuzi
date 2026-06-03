import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/client/hooks/useCamera.ts", "utf8");

assert.match(source, /export interface CameraDevice/);
assert.match(source, /export type CameraFailureReason/);
assert.match(source, /permission-denied/);
assert.match(source, /device-busy/);
assert.match(source, /not-found/);
assert.match(source, /const streamRef = useRef<MediaStream \| undefined>\(undefined\)/);
assert.match(source, /const \[devices, setDevices\]/);
assert.match(source, /const \[selectedDeviceId, setSelectedDeviceId\]/);
assert.match(source, /navigator\.mediaDevices\.enumerateDevices\(\)/);
assert.match(source, /kind === "videoinput"/);
assert.match(source, /&& Boolean\(device\.deviceId\)/);
assert.match(source, /deviceId:\s*{\s*exact:\s*selectedDeviceId\s*}/s);
assert.match(source, /streamRef\.current = mediaStream/);
assert.match(source, /videoRef\.current\.srcObject = streamRef\.current/);
assert.match(source, /\[status, selectedDeviceId\]/);
assert.match(source, /let cancelled = false/);
assert.match(source, /if \(cancelled\)/);
assert.match(source, /cancelled = true/);
assert.match(source, /track\.stop\(\)/);
assert.match(source, /!navigator\.mediaDevices\?\.getUserMedia/);
assert.match(source, /refreshDevices/);
assert.match(source, /failureReason/);

console.log("Camera hook attachment contract passed.");

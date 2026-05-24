import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const smokeDb = path.resolve("data/smoke.db");

mkdirSync(path.dirname(smokeDb), { recursive: true });
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${smokeDb}${suffix}`;
  if (existsSync(file)) rmSync(file, { force: true });
}

const server = spawn(process.execPath, ["dist/server/server/index.js"], {
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_PATH: "data/smoke.db"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let logs = "";
server.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Health check timed out.\n${logs}`);
}

async function json(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function expectStatus(url, status, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (response.status !== status) {
    throw new Error(`${url} returned ${response.status}, expected ${status}`);
  }
  return response;
}

async function run() {
  await waitForHealth();
  const dashboard = await json(`${baseUrl}/api/dashboard`);
  if (!dashboard.courses?.length || !dashboard.students?.length) {
    throw new Error("Seed data missing from dashboard.");
  }

  const provider = await json(`${baseUrl}/api/model-provider`);
  if (provider.provider !== "DeepSeek" || provider.baseURL !== "https://api.deepseek.com") {
    throw new Error("Default model provider is not DeepSeek.");
  }

  const scenario = await json(`${baseUrl}/api/model-provider/scenario-test`, {
    method: "POST",
    body: JSON.stringify({
      ...provider,
      scenario: "student-turn"
    })
  });
  if (scenario.ok !== false || !scenario.message.includes("未启用")) {
    throw new Error("Scenario test did not provide a clear no-key fallback message.");
  }

  const session = await json(`${baseUrl}/api/sessions`, {
    method: "POST",
    body: JSON.stringify({
      courseId: dashboard.courses[0].id,
      selectedStudentIds: dashboard.students.slice(0, 4).map((student) => student.id)
    })
  });

  const turn = await json(`${baseUrl}/api/sessions/${session.id}/turn`, {
    method: "POST",
    body: JSON.stringify({
      teacherText: "同学们，谁能说说直角三角形里最长的边是哪一条？",
      inputMode: "manual"
    })
  });
  if (!turn.responses?.length || !turn.metricEvent) {
    throw new Error("Turn did not produce student responses and metrics.");
  }

  const observation = await json(`${baseUrl}/api/sessions/${session.id}/observations`, {
    method: "POST",
    body: JSON.stringify({
      source: "mediapipe",
      faceVisible: false,
      faceConfidence: 8,
      headDirection: "down",
      expressionActivity: 12,
      stability: 21,
      capturedAt: new Date().toISOString()
    })
  });
  const observationMetrics = observation.observationEvent?.metadata?.observation;
  if (observation.observationEvent?.type !== "teacher_observation" || observationMetrics?.faceConfidence !== 8) {
    throw new Error("Observation route did not persist structured teacher metrics.");
  }
  if (observation.suggestionEvent?.type !== "system_suggestion") {
    throw new Error("Observation route did not return a suggestion for an obvious camera issue.");
  }

  const sessionWithObservation = await json(`${baseUrl}/api/sessions/${session.id}`);
  const persistedObservation = sessionWithObservation.events?.find((event) => event.id === observation.observationEvent.id);
  if (!persistedObservation) {
    throw new Error("Observation event was not saved in the session event stream.");
  }

  await expectStatus(`${baseUrl}/api/sessions/${session.id}/observations`, 400, {
    method: "POST",
    body: JSON.stringify({})
  });

  await expectStatus(`${baseUrl}/api/sessions/${session.id}/observations`, 400, {
    method: "POST",
    body: JSON.stringify({
      ...observationMetrics,
      debug: true
    })
  });

  await expectStatus(`${baseUrl}/api/sessions/${session.id}/observations`, 400, {
    method: "POST",
    body: JSON.stringify({
      ...observationMetrics,
      videoFrame: "data:image/png;base64,abc"
    })
  });

  const transcript = await json(`${baseUrl}/api/sessions/${session.id}/transcripts`, {
    method: "POST",
    body: JSON.stringify({
      segments: [
        {
          sessionId: session.id,
          text: "老师继续追问，为什么这条边最长？",
          isFinal: true,
          source: "web-speech",
          confidence: 0.82,
          startOffsetMs: 0,
          endOffsetMs: 1800,
          language: "zh-CN"
        }
      ],
      sendAsTurn: true
    })
  });
  if (!transcript.transcriptEvents?.length || !transcript.turnResult?.responses?.length) {
    throw new Error("Transcript route did not persist text and trigger a speech turn.");
  }

  const completed = await json(`${baseUrl}/api/sessions/${session.id}/complete`, {
    method: "POST"
  });
  if (!completed.report?.summary) {
    throw new Error("Completion did not produce a report.");
  }

  const completedObservationResponse = await fetch(`${baseUrl}/api/sessions/${session.id}/observations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "fallback",
      faceVisible: false,
      faceConfidence: 0,
      headDirection: "unknown",
      expressionActivity: 0,
      stability: 0,
      capturedAt: new Date().toISOString()
    })
  });
  if (completedObservationResponse.status !== 409) {
    throw new Error("Completed sessions still accepted observation events.");
  }

  console.log("Smoke check passed: dashboard, session, observation, transcript turn, and report are working.");
}

try {
  await run();
} finally {
  server.kill();
}

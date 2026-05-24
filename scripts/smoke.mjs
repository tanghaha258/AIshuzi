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

  console.log("Smoke check passed: dashboard, session, transcript turn, and report are working.");
}

try {
  await run();
} finally {
  server.kill();
}

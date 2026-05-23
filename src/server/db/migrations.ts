import type { DatabaseSync } from "node:sqlite";

const schemaVersion = 2;

export function runMigrations(db: DatabaseSync) {
  db.exec("PRAGMA journal_mode = WAL;");

  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const currentVersion = Number(row.user_version ?? 0);

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade TEXT NOT NULL,
        objectives TEXT NOT NULL,
        topic TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        personality TEXT NOT NULL,
        foundation INTEGER NOT NULL,
        attention INTEGER NOT NULL,
        comprehension INTEGER NOT NULL,
        participation INTEGER NOT NULL,
        behavior_style TEXT NOT NULL,
        status TEXT NOT NULL,
        strategy TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        course_title TEXT NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL,
        selected_student_ids TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        actor TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        metrics TEXT NOT NULL,
        strengths TEXT NOT NULL,
        improvements TEXT NOT NULL,
        key_moments TEXT NOT NULL,
        generated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS model_providers (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        temperature REAL NOT NULL,
        enabled INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS student_runtime_states (
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        attention INTEGER NOT NULL,
        comprehension INTEGER NOT NULL,
        participation INTEGER NOT NULL,
        emotion TEXT NOT NULL,
        pose TEXT NOT NULL,
        status_text TEXT NOT NULL,
        memory TEXT NOT NULL,
        last_spoke_at TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, student_id)
      );
      PRAGMA user_version = ${schemaVersion};
    `);
  }
}

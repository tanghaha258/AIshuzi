import type { DatabaseSync } from "node:sqlite";

const schemaVersion = 9;

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
        overview TEXT NOT NULL,
        evidence TEXT NOT NULL,
        key_timeline TEXT NOT NULL,
        student_responses TEXT NOT NULL,
        teacher_strategy_hits TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        export_markdown TEXT NOT NULL,
        export_html TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        fallback_reason TEXT,
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

  if (currentVersion < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lesson_plans (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        overview TEXT NOT NULL,
        objectives TEXT NOT NULL,
        stages TEXT NOT NULL,
        incidents TEXT NOT NULL,
        recommended_student_ids TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 4) {
    db.exec(`
      ALTER TABLE lesson_plans ADD COLUMN planning_mode TEXT;
      ALTER TABLE lesson_plans ADD COLUMN textbook_version TEXT;
      ALTER TABLE lesson_plans ADD COLUMN volume TEXT;
      ALTER TABLE lesson_plans ADD COLUMN unit TEXT;
      ALTER TABLE lesson_plans ADD COLUMN lesson TEXT;
      ALTER TABLE lesson_plans ADD COLUMN period TEXT;
      CREATE TABLE IF NOT EXISTS model_call_logs (
        id TEXT PRIMARY KEY,
        scenario TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        base_url TEXT NOT NULL,
        status TEXT NOT NULL,
        used_model INTEGER NOT NULL,
        fallback_reason TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion >= 1 && currentVersion < 5) {
    db.exec(`
      ALTER TABLE reports ADD COLUMN overview TEXT;
      ALTER TABLE reports ADD COLUMN evidence TEXT;
      ALTER TABLE reports ADD COLUMN key_timeline TEXT;
      ALTER TABLE reports ADD COLUMN student_responses TEXT;
      ALTER TABLE reports ADD COLUMN teacher_strategy_hits TEXT;
      ALTER TABLE reports ADD COLUMN recommendations TEXT;
      ALTER TABLE reports ADD COLUMN export_markdown TEXT;
      ALTER TABLE reports ADD COLUMN export_html TEXT;
      ALTER TABLE reports ADD COLUMN generated_by TEXT;
      ALTER TABLE reports ADD COLUMN fallback_reason TEXT;
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS training_targets (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        source_session_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        recommendation_title TEXT NOT NULL,
        recommendation_detail TEXT NOT NULL,
        action TEXT NOT NULL,
        evidence_event_ids TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 7) {
    db.exec(`
      ALTER TABLE lesson_plans ADD COLUMN process_evaluation TEXT;
      ALTER TABLE reports ADD COLUMN process_evaluation TEXT;
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 8) {
    db.exec(`
      ALTER TABLE training_targets ADD COLUMN template TEXT NOT NULL DEFAULT '{}';
      PRAGMA user_version = ${schemaVersion};
    `);
  }

  if (currentVersion < 9) {
    db.exec(`
      ALTER TABLE reports ADD COLUMN teacher_observation TEXT;
      PRAGMA user_version = ${schemaVersion};
    `);
  }
}

import type { Client } from "@libsql/client";

/** Safe, idempotent migration for existing SQLite deployments. */
export async function runAdminOperationsMigration(client: Client) {
  const statements = [
    "ALTER TABLE documents ADD COLUMN processingStatus text NOT NULL DEFAULT 'pending'",
    "ALTER TABLE documents ADD COLUMN processingError text",
    "ALTER TABLE documents ADD COLUMN reportCount integer NOT NULL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN moderationNote text",
    "ALTER TABLE assignments ADD COLUMN rubric text",
    "ALTER TABLE assignments ADD COLUMN fileUrl text",
    "ALTER TABLE assignments ADD COLUMN fileKey text",
    "ALTER TABLE assignments ADD COLUMN fileName text",
    "ALTER TABLE assignments ADD COLUMN fileSize integer",
    "ALTER TABLE assignments ADD COLUMN mimeType text",
    "ALTER TABLE assignmentSubmissions ADD COLUMN rubricScores text",
    "ALTER TABLE quizzes ADD COLUMN dueDate integer",
    `CREATE TABLE IF NOT EXISTS learningGoals (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL UNIQUE, dailyStudyMinutes integer NOT NULL DEFAULT 30, dailyFlashcards integer NOT NULL DEFAULT 10, updatedAt integer NOT NULL)`,
    "ALTER TABLE learningGoals ADD COLUMN dailyQuizzes integer NOT NULL DEFAULT 1",
    "CREATE INDEX IF NOT EXISTS learning_goals_user_idx ON learningGoals (userId)",
    `CREATE TABLE IF NOT EXISTS assessmentTemplates (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, lecturerId integer NOT NULL, name text NOT NULL, title text NOT NULL, description text, rubric text, createdAt integer NOT NULL)`,
    "CREATE INDEX IF NOT EXISTS assessment_templates_lecturer_idx ON assessmentTemplates (lecturerId)",
    `CREATE TABLE IF NOT EXISTS adminAuditLogs (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, adminId integer NOT NULL, action text NOT NULL, targetType text NOT NULL, targetId integer NOT NULL, reason text, metadata text, createdAt integer NOT NULL)`,
    "CREATE INDEX IF NOT EXISTS admin_audit_admin_created_idx ON adminAuditLogs (adminId, createdAt)",
    "CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON adminAuditLogs (targetType, targetId)",
    `CREATE TABLE IF NOT EXISTS systemEvents (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, category text NOT NULL, severity text NOT NULL DEFAULT 'error', message text NOT NULL, documentId integer, userId integer, resolvedAt integer, createdAt integer NOT NULL)`,
    "CREATE INDEX IF NOT EXISTS system_events_category_created_idx ON systemEvents (category, createdAt)",
    `CREATE TABLE IF NOT EXISTS agentSessions (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      documentId integer,
      courseId integer,
      intent text,
      learningGoal text,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS agent_sessions_userId_idx ON agentSessions (userId)",
    `CREATE TABLE IF NOT EXISTS agentToolRuns (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      sessionId integer,
      requestId text NOT NULL,
      userId integer NOT NULL,
      toolName text NOT NULL,
      workflow text,
      provider text,
      success integer NOT NULL,
      durationMs integer NOT NULL,
      retrievalCount integer,
      error text,
      createdAt integer NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS agent_tool_runs_requestId_idx ON agentToolRuns (requestId)",
    "CREATE INDEX IF NOT EXISTS agent_tool_runs_userId_idx ON agentToolRuns (userId)",
    `CREATE TABLE IF NOT EXISTS calendarEvents (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      title text NOT NULL,
      type text NOT NULL DEFAULT 'study',
      startsAt integer NOT NULL,
      endsAt integer,
      notes text,
      courseId integer,
      reminderMinutes integer NOT NULL DEFAULT 60,
      reminderSentAt integer,
      source text NOT NULL DEFAULT 'user',
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS calendar_events_user_starts_idx ON calendarEvents (userId, startsAt)",
  ];
  for (const sql of statements) {
    try { await client.execute(sql); }
    catch (error) {
      // SQLite has no ADD COLUMN IF NOT EXISTS; duplicate-column errors are expected after first run.
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  }
}

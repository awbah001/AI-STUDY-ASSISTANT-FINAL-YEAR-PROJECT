/**
 * Creates 4 new tables needed for:
 *   - Assignment submissions
 *   - General (Ask AI) chat history
 *   - Notification inbox
 *   - Password reset tokens
 *
 * Uses CREATE TABLE IF NOT EXISTS — safe to run on every server start.
 * Receives the raw libSQL Client (not the Drizzle wrapper).
 */
import type { Client } from "@libsql/client";

export async function runNewFeatureTablesMigration(client: Client): Promise<void> {
  const statements: string[] = [
    // Tables
    `CREATE TABLE IF NOT EXISTS "assignmentSubmissions" (
      "id"           INTEGER PRIMARY KEY AUTOINCREMENT,
      "assignmentId" INTEGER NOT NULL,
      "studentId"    INTEGER NOT NULL,
      "courseId"     INTEGER NOT NULL,
      "note"         TEXT,
      "fileUrl"      TEXT,
      "fileKey"      TEXT,
      "fileName"     TEXT,
      "fileSize"     INTEGER,
      "mimeType"     TEXT,
      "status"       TEXT NOT NULL DEFAULT 'submitted',
      "grade"        TEXT,
      "feedback"     TEXT,
      "submittedAt"  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      "gradedAt"     INTEGER
    )`,

    `CREATE TABLE IF NOT EXISTS "generalChatMessages" (
      "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId"    INTEGER NOT NULL,
      "role"      TEXT NOT NULL,
      "content"   TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    )`,

    `CREATE TABLE IF NOT EXISTS "notifications" (
      "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId"    INTEGER NOT NULL,
      "title"     TEXT NOT NULL,
      "body"      TEXT NOT NULL,
      "data"      TEXT,
      "isRead"    INTEGER NOT NULL DEFAULT 0,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    )`,

    `CREATE TABLE IF NOT EXISTS "passwordResetTokens" (
      "id"        INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId"    INTEGER NOT NULL,
      "token"     TEXT NOT NULL UNIQUE,
      "expiresAt" INTEGER NOT NULL,
      "usedAt"    INTEGER,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS "submissions_assignmentId_idx" ON "assignmentSubmissions" ("assignmentId")`,
    `CREATE INDEX IF NOT EXISTS "submissions_studentId_idx"    ON "assignmentSubmissions" ("studentId")`,
    `CREATE INDEX IF NOT EXISTS "generalChat_userId_idx"       ON "generalChatMessages"   ("userId")`,
    `CREATE INDEX IF NOT EXISTS "notifications_userId_idx"     ON "notifications"         ("userId")`,
    `CREATE INDEX IF NOT EXISTS "notifications_isRead_idx"     ON "notifications"         ("isRead")`,
    `CREATE INDEX IF NOT EXISTS "resetToken_token_idx"         ON "passwordResetTokens"   ("token")`,
    `CREATE INDEX IF NOT EXISTS "resetToken_userId_idx"        ON "passwordResetTokens"   ("userId")`,
  ];

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      // Silently skip "already exists" errors — everything else is logged
      if (!msg.includes("already exists")) {
        console.error(`[migration] Statement failed: ${msg}\nSQL: ${stmt.slice(0, 80)}…`);
      }
    }
  }

  console.log("[migration] New feature tables ensured");
}

import type { Client } from "@libsql/client";

async function addColumnIfMissing(client: Client, table: string, column: string, definition: string) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  if (info.rows.some((row) => row.name === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function runLecturerInsightsMigration(client: Client) {
  await addColumnIfMissing(client, "assignmentSubmissions", "submissionText", "text");
  await addColumnIfMissing(client, "assignmentSubmissions", "aiDraft", "text");
  await addColumnIfMissing(client, "assignmentSubmissions", "aiDraftedAt", "integer");
  await addColumnIfMissing(client, "generalChatMessages", "courseId", "integer");
  await client.execute(`CREATE TABLE IF NOT EXISTS courseInsightReports (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    courseId integer NOT NULL,
    lecturerId integer NOT NULL,
    periodDays integer NOT NULL,
    periodStart integer NOT NULL,
    periodEnd integer NOT NULL,
    questionCount integer NOT NULL,
    studentCount integer NOT NULL,
    topics text NOT NULL,
    createdAt integer NOT NULL
  )`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS course_insight_reports_course_created_idx ON courseInsightReports (courseId, createdAt)`
  );
}

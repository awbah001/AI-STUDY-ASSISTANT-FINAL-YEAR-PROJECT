import type { Client } from "@libsql/client";

/** Add questionType and essayFeedback columns to quizQuestions for MCQ + essay support. */
export async function runQuestionTypesMigration(client: Client) {
  await client.execute(
    "ALTER TABLE quizQuestions ADD COLUMN questionType text NOT NULL DEFAULT 'mcq'"
  ).catch(() => { /* column already exists */ });
  await client.execute(
    "ALTER TABLE quizQuestions ADD COLUMN essayFeedback text"
  ).catch(() => { /* column already exists */ });
}

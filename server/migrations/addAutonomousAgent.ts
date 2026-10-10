import type { Client } from "@libsql/client";

export async function runAutonomousAgentMigration(client: Client) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS autonomousAgentRuns (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      userId integer NOT NULL,
      status text NOT NULL,
      "trigger" text NOT NULL DEFAULT 'schedule',
      signals text,
      actions text,
      summary text,
      error text,
      usedLlm integer NOT NULL DEFAULT 0,
      durationMs integer NOT NULL DEFAULT 0,
      createdAt integer NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS autonomous_runs_user_created_idx ON autonomousAgentRuns (userId, createdAt)`,
  ];
  for (const sql of statements) {
    await client.execute(sql);
  }
}

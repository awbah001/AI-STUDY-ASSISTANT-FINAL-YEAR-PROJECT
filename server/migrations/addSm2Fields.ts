/**
 * Adds SM-2 spaced-repetition columns to the flashcards table.
 * Uses ALTER TABLE … ADD COLUMN — safe to run every startup because
 * SQLite returns "duplicate column name" which we silently ignore.
 *
 * Receives the raw libSQL Client (not the Drizzle wrapper) so we can
 * call client.execute(sql) directly.
 */
import type { Client } from "@libsql/client";

export async function runSm2Migration(client: Client): Promise<void> {
  const columns: Array<{ name: string; definition: string }> = [
    { name: "easeFactor",  definition: "REAL    NOT NULL DEFAULT 2.5" },
    { name: "srInterval",  definition: "INTEGER NOT NULL DEFAULT 0" },
    { name: "repetitions", definition: "INTEGER NOT NULL DEFAULT 0" },
    { name: "dueDate",     definition: "INTEGER" },
  ];

  for (const col of columns) {
    try {
      await client.execute(
        `ALTER TABLE flashcards ADD COLUMN "${col.name}" ${col.definition}`
      );
      console.log(`[migration] flashcards.${col.name} added`);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        // Column already present — nothing to do
      } else {
        console.error(`[migration] Failed to add flashcards.${col.name}:`, msg);
      }
    }
  }

  // Index on dueDate for efficient "due today" queries
  try {
    await client.execute(
      `CREATE INDEX IF NOT EXISTS "flashcard_dueDate_idx" ON flashcards ("dueDate")`
    );
  } catch {
    // Index already exists — fine
  }
}

import type { Client } from "@libsql/client";

export async function runPersonalNotesMigration(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS personalNotes (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    userId integer NOT NULL, title text NOT NULL, body text NOT NULL,
    sourceKey text NOT NULL, documentId integer, sourceMessageId integer,
    sourceChannel text, version integer NOT NULL DEFAULT 1,
    createdAt integer NOT NULL, updatedAt integer NOT NULL
  )`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS personal_notes_owner_updated ON personalNotes (userId, updatedAt)`
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS personal_notes_source ON personalNotes (userId, sourceKey)`
  );
  const columns = await client.execute("PRAGMA table_info(personalNotes)");
  if (!columns.rows.some(row => row.name === "tags")) {
    try {
      await client.execute(
        "ALTER TABLE personalNotes ADD COLUMN tags text NOT NULL DEFAULT '[]'"
      );
    } catch (error) {
      const after = await client.execute("PRAGMA table_info(personalNotes)");
      if (!after.rows.some(row => row.name === "tags")) throw error;
    }
  }
  for (const [name, definition] of [
    ["courseId", "integer"],
    ["topic", "text NOT NULL DEFAULT ''"],
    ["collection", "text NOT NULL DEFAULT ''"],
  ]) {
    if (!columns.rows.some(row => row.name === name)) {
      try {
        await client.execute(
          `ALTER TABLE personalNotes ADD COLUMN ${name} ${definition}`
        );
      } catch (error) {
        const after = await client.execute("PRAGMA table_info(personalNotes)");
        if (!after.rows.some(row => row.name === name)) throw error;
      }
    }
  }
  await client.execute(
    "CREATE INDEX IF NOT EXISTS personal_notes_organization ON personalNotes (userId, courseId, collection)"
  );
}

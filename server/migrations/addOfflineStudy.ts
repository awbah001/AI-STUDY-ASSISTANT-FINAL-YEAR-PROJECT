import type { Client } from "@libsql/client";

export async function runOfflineStudyMigration(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS offlineStudyEvents (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    userId integer NOT NULL, eventId text NOT NULL, syncedAt integer NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS offline_study_event_key ON offlineStudyEvents (userId, eventId)");
}

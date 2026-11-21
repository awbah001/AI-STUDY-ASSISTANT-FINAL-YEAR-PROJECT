import type { Client } from "@libsql/client";

/**
 * Tables for AI-generated PowerPoint presentations (shared per document) and
 * AI-generated narrated videos (one per student + document). Added alongside
 * the documentSummaries / audioRecaps sharing model.
 */
export async function runPresentationsMigration(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS generatedSlides (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    documentId integer NOT NULL,
    createdBy integer NOT NULL,
    title text NOT NULL,
    subtitle text,
    slideCount integer NOT NULL,
    slides text NOT NULL DEFAULT '[]',
    fileUrl text NOT NULL,
    fileKey text NOT NULL,
    fileSize integer NOT NULL,
    createdAt integer NOT NULL,
    updatedAt integer NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS generated_slides_documentId_idx ON generatedSlides (documentId)");
  // Add slides column to existing tables that were created before this column existed.
  await client.execute("ALTER TABLE generatedSlides ADD COLUMN slides text NOT NULL DEFAULT '[]'").catch(() => {/* column already exists */});

  await client.execute(`CREATE TABLE IF NOT EXISTS generatedVideos (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    userId integer NOT NULL,
    documentId integer NOT NULL,
    title text NOT NULL,
    sceneCount integer NOT NULL,
    durationSeconds integer,
    playerUrl text NOT NULL,
    audioUrl text,
    audioBytes integer,
    voice text,
    scenes text NOT NULL,
    createdAt integer NOT NULL,
    updatedAt integer NOT NULL
  )`);
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS generated_videos_user_document_idx ON generatedVideos (userId, documentId)");
  await client.execute("CREATE INDEX IF NOT EXISTS generated_videos_userId_idx ON generatedVideos (userId)");
}

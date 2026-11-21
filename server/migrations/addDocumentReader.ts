import type { Client } from "@libsql/client";

/** Additive and repeatable; never rewrites existing documents or learning records. */
export async function runDocumentReaderMigration(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS documentAnnotations (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    userId integer NOT NULL, documentId integer NOT NULL, revision text NOT NULL,
    page integer NOT NULL, kind text NOT NULL, excerpt text NOT NULL,
    rects text NOT NULL DEFAULT '[]', body text NOT NULL DEFAULT '',
    requestId text NOT NULL, createdAt integer NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS document_annotations_owner_doc
    ON documentAnnotations (userId, documentId, revision)`);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS document_annotations_request
    ON documentAnnotations (userId, requestId)`);
}

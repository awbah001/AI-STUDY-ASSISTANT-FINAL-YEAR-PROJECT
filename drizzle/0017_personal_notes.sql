CREATE TABLE IF NOT EXISTS personalNotes (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  userId integer NOT NULL, title text NOT NULL, body text NOT NULL,
  sourceKey text NOT NULL, documentId integer, sourceMessageId integer,
  sourceChannel text, version integer NOT NULL DEFAULT 1,
  createdAt integer NOT NULL, updatedAt integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS personal_notes_owner_updated ON personalNotes (userId, updatedAt);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS personal_notes_source ON personalNotes (userId, sourceKey);

CREATE TABLE IF NOT EXISTS documentAnnotations (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  userId integer NOT NULL,
  documentId integer NOT NULL,
  revision text NOT NULL,
  page integer NOT NULL,
  kind text NOT NULL,
  excerpt text NOT NULL,
  rects text NOT NULL DEFAULT '[]',
  body text NOT NULL DEFAULT '',
  requestId text NOT NULL,
  createdAt integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_annotations_owner_doc ON documentAnnotations (userId, documentId, revision);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS document_annotations_request ON documentAnnotations (userId, requestId);

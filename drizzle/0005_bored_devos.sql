PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chatMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_chatMessages`("id", "documentId", "userId", "role", "content", "createdAt") SELECT "id", "documentId", "userId", "role", "content", "createdAt" FROM `chatMessages`;--> statement-breakpoint
DROP TABLE `chatMessages`;--> statement-breakpoint
ALTER TABLE `__new_chatMessages` RENAME TO `chatMessages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `chatMessages` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `chatMessages` (`userId`);--> statement-breakpoint
CREATE TABLE `__new_documentSummaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`summary` text NOT NULL,
	`keyPoints` text,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_documentSummaries`("id", "documentId", "summary", "keyPoints", "createdAt", "updatedAt") SELECT "id", "documentId", "summary", "keyPoints", "createdAt", "updatedAt" FROM `documentSummaries`;--> statement-breakpoint
DROP TABLE `documentSummaries`;--> statement-breakpoint
ALTER TABLE `__new_documentSummaries` RENAME TO `documentSummaries`;--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `documentSummaries` (`documentId`);--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`fileName` text NOT NULL,
	`fileSize` integer NOT NULL,
	`mimeType` text DEFAULT 'application/pdf' NOT NULL,
	`extractedText` text,
	`isFavorite` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.654Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-21T23:11:21.654Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "userId", "title", "description", "fileUrl", "fileKey", "fileName", "fileSize", "mimeType", "extractedText", "isFavorite", "createdAt", "updatedAt") SELECT "id", "userId", "title", "description", "fileUrl", "fileKey", "fileName", "fileSize", "mimeType", "extractedText", "isFavorite", "createdAt", "updatedAt" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `documents` (`userId`);--> statement-breakpoint
CREATE TABLE `__new_flashcards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`reviewCount` integer DEFAULT 0 NOT NULL,
	`lastReviewedAt` integer,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_flashcards`("id", "documentId", "userId", "question", "answer", "isFavorite", "reviewCount", "lastReviewedAt", "createdAt", "updatedAt") SELECT "id", "documentId", "userId", "question", "answer", "isFavorite", "reviewCount", "lastReviewedAt", "createdAt", "updatedAt" FROM `flashcards`;--> statement-breakpoint
DROP TABLE `flashcards`;--> statement-breakpoint
ALTER TABLE `__new_flashcards` RENAME TO `flashcards`;--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `flashcards` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `flashcards` (`userId`);--> statement-breakpoint
CREATE TABLE `__new_progressTracking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`quizzesAttempted` integer DEFAULT 0 NOT NULL,
	`averageQuizScore` real DEFAULT 0,
	`flashcardsCreated` integer DEFAULT 0 NOT NULL,
	`flashcardsReviewed` integer DEFAULT 0 NOT NULL,
	`lastActivityAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_progressTracking`("id", "documentId", "userId", "quizzesAttempted", "averageQuizScore", "flashcardsCreated", "flashcardsReviewed", "lastActivityAt", "createdAt", "updatedAt") SELECT "id", "documentId", "userId", "quizzesAttempted", "averageQuizScore", "flashcardsCreated", "flashcardsReviewed", "lastActivityAt", "createdAt", "updatedAt" FROM `progressTracking`;--> statement-breakpoint
DROP TABLE `progressTracking`;--> statement-breakpoint
ALTER TABLE `__new_progressTracking` RENAME TO `progressTracking`;--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `progressTracking` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `progressTracking` (`userId`);--> statement-breakpoint
CREATE TABLE `__new_quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`totalQuestions` integer NOT NULL,
	`score` text,
	`completedAt` integer,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.655Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_quizzes`("id", "documentId", "userId", "title", "totalQuestions", "score", "completedAt", "createdAt") SELECT "id", "documentId", "userId", "title", "totalQuestions", "score", "completedAt", "createdAt" FROM `quizzes`;--> statement-breakpoint
DROP TABLE `quizzes`;--> statement-breakpoint
ALTER TABLE `__new_quizzes` RENAME TO `quizzes`;--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `quizzes` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `quizzes` (`userId`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`passwordHash` text,
	`avatarUrl` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-21T23:11:21.653Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-21T23:11:21.654Z"' NOT NULL,
	`lastSignedIn` integer DEFAULT '"2026-04-21T23:11:21.654Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "openId", "name", "email", "loginMethod", "passwordHash", "avatarUrl", "role", "createdAt", "updatedAt", "lastSignedIn") SELECT "id", "openId", "name", "email", "loginMethod", "passwordHash", "avatarUrl", "role", "createdAt", "updatedAt", "lastSignedIn" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
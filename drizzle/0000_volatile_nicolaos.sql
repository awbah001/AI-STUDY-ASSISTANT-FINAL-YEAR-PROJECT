CREATE TABLE `chatMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.903Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `chatMessages` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `chatMessages` (`userId`);--> statement-breakpoint
CREATE TABLE `documentSummaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`summary` text NOT NULL,
	`keyPoints` text,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.903Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-14T00:37:57.903Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `documentSummaries` (`documentId`);--> statement-breakpoint
CREATE TABLE `documents` (
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
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.902Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-14T00:37:57.902Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `documents` (`userId`);--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`reviewCount` integer DEFAULT 0 NOT NULL,
	`lastReviewedAt` integer,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.903Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-14T00:37:57.903Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `flashcards` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `flashcards` (`userId`);--> statement-breakpoint
CREATE TABLE `progressTracking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`quizzesAttempted` integer DEFAULT 0 NOT NULL,
	`averageQuizScore` real DEFAULT 0,
	`flashcardsCreated` integer DEFAULT 0 NOT NULL,
	`flashcardsReviewed` integer DEFAULT 0 NOT NULL,
	`lastActivityAt` integer DEFAULT '"2026-04-14T00:37:57.904Z"' NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.904Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-14T00:37:57.904Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `progressTracking` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `progressTracking` (`userId`);--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quizId` integer NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`correctAnswer` text NOT NULL,
	`explanation` text,
	`userAnswer` text,
	`isCorrect` integer
);
--> statement-breakpoint
CREATE INDEX `quizIdIdx` ON `quizQuestions` (`quizId`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`totalQuestions` integer NOT NULL,
	`score` text,
	`completedAt` integer,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.904Z"' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `quizzes` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `quizzes` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT '"2026-04-14T00:37:57.901Z"' NOT NULL,
	`updatedAt` integer DEFAULT '"2026-04-14T00:37:57.901Z"' NOT NULL,
	`lastSignedIn` integer DEFAULT '"2026-04-14T00:37:57.901Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);
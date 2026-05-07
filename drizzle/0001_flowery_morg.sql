CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`summary` text NOT NULL,
	`keyPoints` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentSummaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(100) NOT NULL DEFAULT 'application/pdf',
	`extractedText` text,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`reviewCount` int NOT NULL DEFAULT 0,
	`lastReviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progressTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`quizzesAttempted` int NOT NULL DEFAULT 0,
	`averageQuizScore` decimal(5,2) DEFAULT 0,
	`flashcardsCreated` int NOT NULL DEFAULT 0,
	`flashcardsReviewed` int NOT NULL DEFAULT 0,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `progressTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`question` text NOT NULL,
	`options` json NOT NULL,
	`correctAnswer` varchar(255) NOT NULL,
	`explanation` text,
	`userAnswer` varchar(255),
	`isCorrect` boolean,
	CONSTRAINT `quizQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`totalQuestions` int NOT NULL,
	`score` decimal(5,2),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `chatMessages` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `chatMessages` (`userId`);--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `documentSummaries` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `documents` (`userId`);--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `flashcards` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `flashcards` (`userId`);--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `progressTracking` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `progressTracking` (`userId`);--> statement-breakpoint
CREATE INDEX `quizIdIdx` ON `quizQuestions` (`quizId`);--> statement-breakpoint
CREATE INDEX `documentIdIdx` ON `quizzes` (`documentId`);--> statement-breakpoint
CREATE INDEX `userIdIdx` ON `quizzes` (`userId`);
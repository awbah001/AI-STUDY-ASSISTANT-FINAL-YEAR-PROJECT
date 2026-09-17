CREATE TABLE IF NOT EXISTS `calendarEvents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'study' NOT NULL,
	`startsAt` integer NOT NULL,
	`endsAt` integer,
	`notes` text,
	`courseId` integer,
	`reminderMinutes` integer DEFAULT 60 NOT NULL,
	`reminderSentAt` integer,
	`source` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `calendar_events_user_starts_idx` ON `calendarEvents` (`userId`,`startsAt`);

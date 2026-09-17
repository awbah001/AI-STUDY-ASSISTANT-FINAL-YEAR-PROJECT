CREATE TABLE IF NOT EXISTS `agentSessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`documentId` integer,
	`courseId` integer,
	`intent` text,
	`learningGoal` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agent_sessions_userId_idx` ON `agentSessions` (`userId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agentToolRuns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer,
	`requestId` text NOT NULL,
	`userId` integer NOT NULL,
	`toolName` text NOT NULL,
	`workflow` text,
	`provider` text,
	`success` integer NOT NULL,
	`durationMs` integer NOT NULL,
	`retrievalCount` integer,
	`error` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agent_tool_runs_requestId_idx` ON `agentToolRuns` (`requestId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agent_tool_runs_userId_idx` ON `agentToolRuns` (`userId`);

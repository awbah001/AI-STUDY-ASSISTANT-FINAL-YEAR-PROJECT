ALTER TABLE `users` ADD COLUMN `passwordHash` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);


CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`symbol` text,
	`title` text NOT NULL,
	`detail` text,
	`status` text NOT NULL,
	`source_url` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`date`);--> statement-breakpoint
CREATE TABLE `news` (
	`id` text PRIMARY KEY NOT NULL,
	`symbols` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`publisher` text,
	`published_at` text,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `news_published_idx` ON `news` (`published_at`);--> statement-breakpoint
CREATE TABLE `prices` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`open` real,
	`high` real,
	`low` real,
	`close` real NOT NULL,
	`volume` real,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	`check_close` real,
	`check_source` text,
	`check_status` text,
	`checked_at` text,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE INDEX `prices_date_idx` ON `prices` (`date`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`summary` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `runs_job_idx` ON `runs` (`job`,`started_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`trade_date` text NOT NULL,
	`revision` integer NOT NULL,
	`digest` text NOT NULL,
	`reason` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`trade_date`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `weights` (
	`as_of` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`weight_pct` real NOT NULL,
	`shares` real,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`as_of`, `ticker`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
CREATE TABLE `ai_usage` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
--> statement-breakpoint
ALTER TABLE `news` ADD `points_zh` text;
CREATE TABLE `devices` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_key` text NOT NULL,
	`environment` text NOT NULL,
	`app_version` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `devices_user_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `push_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`devices` integer NOT NULL,
	`delivered` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_log_created_idx` ON `push_log` (`created_at`);
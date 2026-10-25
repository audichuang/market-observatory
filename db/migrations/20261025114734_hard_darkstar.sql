CREATE TABLE `news_digests` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`tone` text NOT NULL,
	`news_ids` text NOT NULL,
	`digest` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE INDEX `news_digests_date_idx` ON `news_digests` (`date`);--> statement-breakpoint
ALTER TABLE `news` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `news` ADD `primary_symbol` text;--> statement-breakpoint
ALTER TABLE `news` ADD `title_zh` text;--> statement-breakpoint
ALTER TABLE `news` ADD `tone` text;--> statement-breakpoint
ALTER TABLE `news` ADD `category` text;--> statement-breakpoint
ALTER TABLE `news` ADD `focus` text;--> statement-breakpoint
ALTER TABLE `news` ADD `enriched_at` text;--> statement-breakpoint
CREATE INDEX `news_enriched_idx` ON `news` (`enriched_at`);
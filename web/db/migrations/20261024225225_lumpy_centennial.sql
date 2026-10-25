CREATE TABLE `analyst_views` (
	`symbol` text NOT NULL,
	`as_of` text NOT NULL,
	`price` real,
	`price_date` text,
	`target_mean` real,
	`target_low` real,
	`target_high` real,
	`buy` integer NOT NULL,
	`hold` integer NOT NULL,
	`sell` integer NOT NULL,
	`fiscal_end` text,
	`eps_forecast` real,
	`eps_up` integer,
	`eps_down` integer,
	`estimates` integer,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`symbol`, `as_of`)
);
--> statement-breakpoint
CREATE INDEX `analyst_views_asof_idx` ON `analyst_views` (`as_of`);--> statement-breakpoint
CREATE TABLE `forecasts` (
	`trade_date` text PRIMARY KEY NOT NULL,
	`probability` real NOT NULL,
	`base_rate` real NOT NULL,
	`basis` text NOT NULL,
	`call` text NOT NULL,
	`close` real NOT NULL,
	`created_at` text NOT NULL
);

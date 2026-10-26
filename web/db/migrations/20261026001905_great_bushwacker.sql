ALTER TABLE `forecasts` ADD `model_version` text;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `regime` text;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `cond_p` real;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `cond_n_eff` real;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `bss_low` real;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `history_start` text;--> statement-breakpoint
ALTER TABLE `forecasts` ADD `detail` text;
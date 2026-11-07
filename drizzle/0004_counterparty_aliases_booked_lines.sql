CREATE TABLE `booked_line` (
	`key` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`spending_id` integer,
	`skip_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`spending_id`) REFERENCES `spending`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booked_line_date_idx` ON `booked_line` (`date`);--> statement-breakpoint
CREATE INDEX `booked_line_spending_idx` ON `booked_line` (`spending_id`);--> statement-breakpoint
CREATE TABLE `counterparty_alias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`counterparty_id` integer NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`counterparty_id`) REFERENCES `counterparty`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counterparty_alias_kind_value_unique` ON `counterparty_alias` (`kind`,`value`);--> statement-breakpoint
CREATE INDEX `counterparty_alias_counterparty_idx` ON `counterparty_alias` (`counterparty_id`);--> statement-breakpoint
-- Keep what the reverted statement import already booked, and the counterparties' IBAN and name match.
INSERT INTO `booked_line` (`key`, `date`, `amount`, `spending_id`, `skip_reason`, `created_at`)
	SELECT `key`, `date`, `amount`, `spending_id`, CASE WHEN `spending_id` IS NULL THEN 'Overgeslagen' END, `created_at`
	FROM `statement_line` WHERE `spending_id` IS NOT NULL OR `skipped` = 1;--> statement-breakpoint
INSERT INTO `counterparty_alias` (`counterparty_id`, `kind`, `value`)
	SELECT `id`, 'iban', `iban` FROM `counterparty` WHERE `iban` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `counterparty_alias` (`counterparty_id`, `kind`, `value`)
	SELECT `id`, 'name', lower(trim(`match`)) FROM `counterparty` WHERE length(trim(`match`)) >= 2;--> statement-breakpoint
DROP TABLE `statement_line`;--> statement-breakpoint
DROP INDEX `counterparty_iban_unique`;--> statement-breakpoint
ALTER TABLE `counterparty` ADD `handling` text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE `counterparty` DROP COLUMN `iban`;--> statement-breakpoint
ALTER TABLE `counterparty` DROP COLUMN `match`;--> statement-breakpoint
ALTER TABLE `counterparty` DROP COLUMN `mode`;
CREATE TABLE `savings_account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`until` text,
	`withdrawals` text NOT NULL,
	`scenario_ids` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `balance` ADD `savings_account_id` integer REFERENCES savings_account(id);--> statement-breakpoint
ALTER TABLE `balance` ADD `time` text;--> statement-breakpoint
-- The single savings plan becomes the first savings account; its balance becomes its first checkpoint.
INSERT INTO `savings_account` (`name`, `until`, `withdrawals`, `created_at`, `updated_at`)
SELECT 'Spaarrekening', json_extract(`plan`, '$.until'), json_extract(`plan`, '$.withdrawals'), unixepoch(), unixepoch()
FROM `savings` WHERE `id` = 1;--> statement-breakpoint
INSERT INTO `balance` (`account`, `savings_account_id`, `date`, `amount`, `created_at`)
SELECT 'savings', (SELECT max(`id`) FROM `savings_account`), json_extract(`plan`, '$.date'),
	CAST(round(json_extract(`plan`, '$.balance') * 100) AS integer), unixepoch()
FROM `savings` WHERE `id` = 1;--> statement-breakpoint
DROP TABLE `savings`;

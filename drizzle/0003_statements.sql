CREATE TABLE `statement_line` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account` text NOT NULL,
	`key` text NOT NULL,
	`date` text NOT NULL,
	`paid_at` text,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`iban` text,
	`remittance` text,
	`description` text NOT NULL,
	`counterparty_id` integer,
	`spending_id` integer,
	`skipped` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`counterparty_id`) REFERENCES `counterparty`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`spending_id`) REFERENCES `spending`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statement_line_key_unique` ON `statement_line` (`key`);--> statement-breakpoint
CREATE INDEX `statement_line_date_idx` ON `statement_line` (`date`);--> statement-breakpoint
CREATE INDEX `statement_line_spending_idx` ON `statement_line` (`spending_id`);--> statement-breakpoint
ALTER TABLE `counterparty` ADD `match` text;--> statement-breakpoint
ALTER TABLE `counterparty` ADD `mode` text DEFAULT 'spending' NOT NULL;
CREATE TABLE `savings_transfer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`savings_account_id` integer NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`savings_account_id`) REFERENCES `savings_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `savings_transfer_account_date_idx` ON `savings_transfer` (`savings_account_id`,`date`);--> statement-breakpoint
CREATE INDEX `savings_transfer_date_idx` ON `savings_transfer` (`date`);--> statement-breakpoint
ALTER TABLE `booked_line` ADD `savings_transfer_id` integer REFERENCES savings_transfer(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `booked_line_savings_transfer_idx` ON `booked_line` (`savings_transfer_id`);--> statement-breakpoint
ALTER TABLE `savings_account` ADD `iban` text;--> statement-breakpoint
CREATE UNIQUE INDEX `savings_account_iban_unique` ON `savings_account` (`iban`);
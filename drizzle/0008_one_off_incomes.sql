CREATE TABLE `one_off_income` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`counterparty_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`counterparty_id`) REFERENCES `counterparty`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `one_off_income_date_idx` ON `one_off_income` (`date`);--> statement-breakpoint
ALTER TABLE `booked_line` ADD `one_off_income_id` integer REFERENCES one_off_income(id);--> statement-breakpoint
CREATE INDEX `booked_line_one_off_income_idx` ON `booked_line` (`one_off_income_id`);
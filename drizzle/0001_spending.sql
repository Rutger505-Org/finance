CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_unique` ON `category` (`name`);--> statement-breakpoint
CREATE TABLE `counterparty` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`iban` text,
	`category_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counterparty_iban_unique` ON `counterparty` (`iban`);--> statement-breakpoint
CREATE TABLE `outing` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spending` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`category_id` integer,
	`outing_id` integer,
	`counterparty_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`outing_id`) REFERENCES `outing`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`counterparty_id`) REFERENCES `counterparty`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `spending_date_idx` ON `spending` (`date`);--> statement-breakpoint
CREATE INDEX `spending_outing_idx` ON `spending` (`outing_id`);--> statement-breakpoint
INSERT INTO `category` (`name`, `created_at`, `updated_at`) VALUES
	('Drinken', unixepoch(), unixepoch()),
	('Eten', unixepoch(), unixepoch()),
	('Tickets', unixepoch(), unixepoch()),
	('Tech/opleiding', unixepoch(), unixepoch()),
	('Vervoer', unixepoch(), unixepoch()),
	('Overig', unixepoch(), unixepoch());

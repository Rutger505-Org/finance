CREATE TABLE `savings` (
	`id` integer PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`real` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_name_unique` ON `scenario` (`name`);--> statement-breakpoint
ALTER TABLE `expense` ADD `scenario_ids` text;--> statement-breakpoint
ALTER TABLE `income` ADD `scenario_ids` text;--> statement-breakpoint
-- There is always exactly one real scenario: the overview and transfers use it.
INSERT INTO `scenario` (`name`, `real`, `created_at`, `updated_at`) VALUES ('Huidig', 1, unixepoch(), unixepoch());

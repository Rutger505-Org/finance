ALTER TABLE `booked_line` ADD `plan_kind` text;--> statement-breakpoint
ALTER TABLE `booked_line` ADD `plan_income_id` integer;--> statement-breakpoint
ALTER TABLE `booked_line` ADD `plan_expense_id` integer;--> statement-breakpoint
ALTER TABLE `booked_line` ADD `plan_transfer` text;--> statement-breakpoint
ALTER TABLE `booked_line` ADD `plan_date` text;--> statement-breakpoint
CREATE INDEX `booked_line_plan_idx` ON `booked_line` (`plan_kind`);--> statement-breakpoint
ALTER TABLE `category` ADD `excluded` integer DEFAULT false NOT NULL;
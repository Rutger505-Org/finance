-- One transfer becomes a list. SQLite can't add a NOT NULL column without a default to a filled table.
ALTER TABLE `settings` ADD `transfers` text NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE `settings` SET `transfers` = json_array(json_set(`transfer`, '$.name', 'Overboeking naar vaste lasten'));--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `transfer`;

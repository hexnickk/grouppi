DELETE FROM `telegram_messages`;--> statement-breakpoint
DELETE FROM `telegram_chat_memory`;--> statement-breakpoint
CREATE TABLE `telegram_chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pub_id` integer NOT NULL,
	`approved` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `telegram_chats_pub_id_idx` ON `telegram_chats` (`pub_id`);--> statement-breakpoint
DROP TABLE `telegram_user_memory`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_telegram_chat_memory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`memory` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `telegram_chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_telegram_chat_memory`("id", "chat_id", "memory", "created_at") SELECT "id", "chat_id", "memory", "created_at" FROM `telegram_chat_memory`;--> statement-breakpoint
DROP TABLE `telegram_chat_memory`;--> statement-breakpoint
ALTER TABLE `__new_telegram_chat_memory` RENAME TO `telegram_chat_memory`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `telegram_chat_memory_chat_id_idx` ON `telegram_chat_memory` (`chat_id`);--> statement-breakpoint
DROP INDEX `telegram_messages_group_id_idx`;--> statement-breakpoint
ALTER TABLE `telegram_messages` ADD `chat_id` integer NOT NULL REFERENCES telegram_chats(id);--> statement-breakpoint
CREATE INDEX `telegram_messages_group_id_idx` ON `telegram_messages` (`chat_id`);--> statement-breakpoint
ALTER TABLE `telegram_messages` DROP COLUMN `group_id`;--> statement-breakpoint
ALTER TABLE `telegram_messages` DROP COLUMN `updated_at`;--> statement-breakpoint
ALTER TABLE `telegram_users` DROP COLUMN `updated_at`;
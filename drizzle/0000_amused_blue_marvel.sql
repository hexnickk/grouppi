CREATE TABLE `telegram_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `telegram_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_messages_group_id_idx` ON `telegram_messages` (`group_id`);--> statement-breakpoint
CREATE TABLE `telegram_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pub_id` integer NOT NULL,
	`username` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_users_pub_id_unique` ON `telegram_users` (`pub_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_users_username_unique` ON `telegram_users` (`username`);--> statement-breakpoint
CREATE INDEX `telegram_users_pub_id_idx` ON `telegram_users` (`pub_id`);
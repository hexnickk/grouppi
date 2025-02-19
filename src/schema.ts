import { sql } from "drizzle-orm";
import { text, sqliteTable, int, index } from "drizzle-orm/sqlite-core";

export const telegramUsersSchema = sqliteTable(
  "telegram_users",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    pubId: int("pub_id").notNull().unique(),
    username: text("username").unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_users_pub_id_idx").on(table.pubId)],
);

export type SelectTelegramUsersSchema = typeof telegramUsersSchema.$inferSelect;

export const telegramMessagesSchema = sqliteTable(
  "telegram_messages",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    chatId: int("chat_id")
      .notNull()
      .references(() => telegramChatsSchema.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => telegramUsersSchema.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_messages_group_id_idx").on(table.chatId)],
);

export const telegramChatMemorySchema = sqliteTable(
  "telegram_chat_memory",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    chatId: int("chat_id")
      .notNull()
      .references(() => telegramChatsSchema.id, { onDelete: "cascade" }),
    memory: text("memory").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_chat_memory_chat_id_idx").on(table.chatId)],
);

export const telegramChatsSchema = sqliteTable(
  "telegram_chats",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    pubId: int("pub_id").notNull(),
    approved: int("approved", { mode: "boolean" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_chats_pub_id_idx").on(table.pubId)],
);

export type SelectTelegramChatsSchema = typeof telegramChatsSchema.$inferSelect;

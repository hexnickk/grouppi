import { sql } from "drizzle-orm";
import { text, sqliteTable, int, index } from "drizzle-orm/sqlite-core";

export const telegramUsersSchema = sqliteTable(
  "telegram_users",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    pub_id: int("pub_id").notNull().unique(),
    username: text("username").unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_users_pub_id_idx").on(table.pub_id)],
);

export type SelectTelegramUsersSchema = typeof telegramUsersSchema.$inferSelect;

export const telegramMessagesSchema = sqliteTable(
  "telegram_messages",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    groupId: int("group_id").notNull(),
    userId: int("user_id")
      .notNull()
      .references(() => telegramUsersSchema.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("telegram_messages_group_id_idx").on(table.groupId)],
);

export const telegramChatMemorySchema = sqliteTable(
  "telegram_chat_memory",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    chatId: int("chat_id").notNull(),
    memory: text("memory").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("memory_chat_id_idx").on(table.chatId)],
);

export const telegramUserMemorySchema = sqliteTable(
  "telegram_user_memory",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    userId: int("user_id").notNull(),
    memory: text("memory").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("memory_user_id_idx").on(table.userId)],
);

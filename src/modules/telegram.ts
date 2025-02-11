import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "../db";
import { telegramMessagesSchema, telegramUsersSchema } from "../schema";

export class TelegramService {
  async getLastMessages(groupId: number, count: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(eq(telegramMessagesSchema.groupId, groupId))
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      )
      .limit(count);
  }

  async getDayMessages(groupId: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(
        and(
          eq(telegramMessagesSchema.groupId, groupId),
          sql`${telegramMessagesSchema.createdAt} >= datetime('now', '-1 day')`,
        ),
      )
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      );
  }

  async getWeekMessages(groupId: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(
        and(
          eq(telegramMessagesSchema.groupId, groupId),
          sql`${telegramMessagesSchema.createdAt} >= datetime('now', '-7 day')`,
        ),
      )
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      );
  }
}

export const telegramService = new TelegramService();

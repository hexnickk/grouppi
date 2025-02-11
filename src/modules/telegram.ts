import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { telegramMessagesSchema } from "../schema";

export class TelegramService {
  async getLastMessages(groupId: number, count: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(eq(telegramMessagesSchema.groupId, groupId))
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .limit(count);
  }
}

export const telegramService = new TelegramService();

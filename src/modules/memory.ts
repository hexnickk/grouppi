import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { telegramChatMemorySchema } from "../schema.js";

export class MemoryService {
  async readChatMemory(chatId: number) {
    return await db
      .select()
      .from(telegramChatMemorySchema)
      .where(eq(telegramChatMemorySchema.chatId, chatId));
  }

  async saveChatMemoryEntry(chatId: number, memory: string) {
    await db.insert(telegramChatMemorySchema).values({
      chatId,
      memory,
    });
  }

  async deleteChatMemoryEntry(chatId: number, entryId: number) {
    await db
      .delete(telegramChatMemorySchema)
      .where(
        and(
          eq(telegramChatMemorySchema.chatId, chatId),
          eq(telegramChatMemorySchema.id, entryId),
        ),
      );
  }
}

export const memoryService = new MemoryService();

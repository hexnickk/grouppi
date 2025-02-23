import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  SelectTelegramChatsSchema,
  SelectTelegramUsersSchema,
  telegramChatsSchema,
  telegramMessagesSchema,
  telegramUsersSchema,
} from "../schema.js";
import { bot } from "../index.js";
import { Context } from "grammy";
import { Config } from "./config.js";

export namespace Telegram {
  let botUser: SelectTelegramUsersSchema;

  export const isOwnerChat = async (ctx: Context) => {
    const ownerChatId = await Config.getConfig("TELEGRAM_BOT_OWNER_CHAT_ID");
    if (!ownerChatId) {
      return false;
    }
    return ctx.chat?.id === Number(ownerChatId);
  };

  export const approveChat = async (chatId: number) => {
    await db
      .update(telegramChatsSchema)
      .set({ approved: true })
      .where(eq(telegramChatsSchema.pubId, chatId));
  };

  export const rejectChat = async (chatId: number) => {
    await db
      .update(telegramChatsSchema)
      .set({ approved: false })
      .where(eq(telegramChatsSchema.pubId, chatId));
  };

  export const getChatByPubId = async (
    chatId: number,
  ): Promise<SelectTelegramChatsSchema | undefined> => {
    let [chat] = await db
      .select()
      .from(telegramChatsSchema)
      .where(eq(telegramChatsSchema.pubId, chatId))
      .limit(1);

    return chat;
  };

  export const createChat = async (chatId: number) => {
    const [chat] = await db
      .insert(telegramChatsSchema)
      .values({ pubId: chatId })
      .returning();
    return chat;
  };

  export const getUserByPubId = async (userId: number) => {
    let [user] = await db
      .select()
      .from(telegramUsersSchema)
      .where(eq(telegramUsersSchema.pubId, userId))
      .limit(1);
    return user;
  };

  export const createUser = async ({
    pubId,
    username,
    firstName,
    lastName,
  }: {
    pubId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    const [user] = await db
      .insert(telegramUsersSchema)
      .values({
        pubId,
        username,
        firstName,
        lastName,
      })
      .returning();
    return user;
  };

  export const trackMessage = async ({
    chatId,
    userId,
    message,
  }: {
    chatId: number;
    userId: number;
    message: string;
  }) => {
    await db.insert(telegramMessagesSchema).values({
      chatId,
      userId,
      message,
    });
  };

  export const getBotId = async () => {
    if (botUser) {
      return botUser.id;
    }

    const info = await bot.api.getMe();

    const existingUser = await getUserByPubId(info.id);
    if (existingUser) {
      botUser = existingUser;
      return botUser.id;
    }

    const newUser = await createUser({
      pubId: info.id,
      username: info.username,
    });
    botUser = newUser;
    return botUser.id;
  };
}

export class TelegramService {
  async getLastMessages(chatId: number, count: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(eq(telegramMessagesSchema.chatId, chatId))
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      )
      .limit(count);
  }

  async getDayMessages(chatId: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(
        and(
          eq(telegramMessagesSchema.chatId, chatId),
          sql`${telegramMessagesSchema.createdAt} >= datetime('now', '-1 day')`,
        ),
      )
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      );
  }

  async getWeekMessages(chatId: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(
        and(
          eq(telegramMessagesSchema.chatId, chatId),
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

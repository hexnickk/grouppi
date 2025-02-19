import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "../db";
import {
  SelectTelegramChatsSchema,
  SelectTelegramUsersSchema,
  telegramChatsSchema,
  telegramMessagesSchema,
  telegramUsersSchema,
} from "../schema";
import { Context, Markup } from "telegraf";
import { Chat } from "telegraf/types";
import { bot } from "..";

export interface TgBotContext extends Context {
  botTelegramUser: SelectTelegramUsersSchema;
  adminTelegramChat: Chat.PrivateChat;
}

export interface TgRequestContext extends TgBotContext {
  telegramUser?: SelectTelegramUsersSchema;
  telegramChat?: SelectTelegramChatsSchema;
}

export type TgNext = () => Promise<void>;

export const chatTypeMiddleware = (ctx: TgRequestContext, next: TgNext) => {
  if (ctx.chat?.type !== "private" && ctx.chat?.type !== "group") {
    return;
  }
  return next();
};

export const botTelegramUserMiddleware = async (
  ctx: TgRequestContext,
  next: TgNext,
) => {
  if (bot.context.botTelegramUser == null) {
    const botInfo = await bot.telegram.getMe();

    let botTelegramUser: SelectTelegramUsersSchema;
    const [existingBotTelegramUser] = await db
      .select()
      .from(telegramUsersSchema)
      .where(eq(telegramUsersSchema.pubId, botInfo.id));
    botTelegramUser = existingBotTelegramUser;

    if (!existingBotTelegramUser) {
      const [newBotTelegramUser] = await db
        .insert(telegramUsersSchema)
        .values({
          pubId: botInfo.id,
          username: botInfo.username,
        })
        .returning();
      botTelegramUser = newBotTelegramUser;
    }
    bot.context.botTelegramUser = botTelegramUser;
  }

  if (bot.context.botTelegramUser == null) {
    console.error("Bot user not initialized.");
    return;
  }

  return await next();
};

export const adminTelegramChatMiddleware = async (
  ctx: TgRequestContext,
  next: TgNext,
) => {
  if (
    bot.context.adminTelegramChat == null &&
    ctx.chat?.type === "private" &&
    ctx.from?.username === process.env.TELEGRAM_BOT_OWNER &&
    process.env.TELEGRAM_BOT_OWNER != null
  ) {
    bot.context.adminTelegramChat = ctx.chat;
  }

  if (bot.context.adminTelegramChat == null) {
    console.error("Admin chat not initialized.");
    return;
  }
  return await next();
};

export const telegramUserMiddleware = async (
  ctx: TgRequestContext,
  next: TgNext,
) => {
  if (ctx.from?.id == null) {
    return;
  }
  let user: SelectTelegramUsersSchema;
  const [existingUser] = await db
    .select()
    .from(telegramUsersSchema)
    .where(eq(telegramUsersSchema.pubId, ctx.from.id))
    .limit(1);
  user = existingUser;
  if (existingUser == null) {
    const [newUser] = await db
      .insert(telegramUsersSchema)
      .values({
        pubId: ctx.from.id,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      })
      .returning();
    user = newUser;
  }
  ctx.telegramUser = user;
  return await next();
};

export const telegramChatMiddleware = async (
  ctx: TgRequestContext,
  next: TgNext,
) => {
  if (ctx.chat?.id == null) {
    return;
  }
  const [existingChat] = await db
    .select()
    .from(telegramChatsSchema)
    .where(eq(telegramChatsSchema.pubId, ctx.chat.id));
  if (existingChat == null) {
    await db.insert(telegramChatsSchema).values({ pubId: ctx.chat.id });

    if (ctx.chat?.type === "private") {
      bot.telegram.sendMessage(
        bot.context.adminTelegramChat?.id!,
        `New private chat with @${ctx.from?.username} ${ctx.from?.first_name} ${ctx.from?.last_name} (${ctx.chat.id}) added to the database. Please approve or reject it.`,
        {
          ...Markup.inlineKeyboard([
            Markup.button.callback("Approve", `approve_chat_${ctx.chat.id}`),
            Markup.button.callback("Reject", `reject_chat_${ctx.chat.id}`),
          ]),
        },
      );
      return await ctx.reply(
        "We will let you know once your usage is approved 🤝",
      );
    } else {
      bot.telegram.sendMessage(
        bot.context.adminTelegramChat?.id!,
        `New group chat "${ctx.chat.title}" (${ctx.chat.id}) added to the database. Please approve or reject it.`,
        {
          ...Markup.inlineKeyboard([
            Markup.button.callback("Approve", `approve_chat_${ctx.chat.id}`),
            Markup.button.callback("Reject", `reject_chat_${ctx.chat.id}`),
          ]),
        },
      );
      return;
    }
  }
  if (
    ctx.chat?.id !== bot.context.adminTelegramChat?.id &&
    (existingChat.approved == null || existingChat.approved === false)
  ) {
    return;
  }
  ctx.telegramChat = existingChat;
  return await next();
};

export const telegramMessagesMiddleware = async (
  ctx: TgRequestContext,
  next: TgNext,
) => {
  if (ctx.message != null && "text" in ctx.message) {
    console.log({
      chatId: ctx.telegramChat?.id!,
      userId: ctx.telegramUser?.id!,
      message: ctx.message.text,
    });
    await db.insert(telegramMessagesSchema).values({
      chatId: ctx.telegramChat?.id!,
      userId: ctx.telegramUser?.id!,
      message: ctx.message?.text,
    });
  }

  return await next();
};

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

  async getWeekMessages(groupId: number) {
    return await db
      .select()
      .from(telegramMessagesSchema)
      .where(
        and(
          eq(telegramMessagesSchema.chatId, groupId),
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

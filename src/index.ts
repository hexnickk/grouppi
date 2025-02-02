import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { openAIService } from "./modules/openai";
import { db } from "./db";
import {
  SelectTelegramUsersSchema,
  telegramMessagesSchema,
  telegramUsersSchema,
} from "./schema";
import { desc, eq } from "drizzle-orm";

// Add custom context interface
interface BotContext extends Context {
  botTelegramUser?: SelectTelegramUsersSchema;
}

const whitelist = process.env
  .TELEGRAM_GROUP_ID_WHITELIST!.split(",")
  .map(Number);
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_TOKEN!);
const BOT_MEMORY_WINDOW = 20;

let _botTelegramUser: SelectTelegramUsersSchema;

async function initializeBotUser(bot: Telegraf) {
  const botInfo = await bot.telegram.getMe();

  let botTelegramUser: SelectTelegramUsersSchema;
  const [existingBotTelegramUser] = await db
    .select()
    .from(telegramUsersSchema)
    .where(eq(telegramUsersSchema.pub_id, botInfo.id));
  botTelegramUser = existingBotTelegramUser;

  if (!existingBotTelegramUser) {
    const [newBotTelegramUser] = await db
      .insert(telegramUsersSchema)
      .values({
        pub_id: botInfo.id,
        username: botInfo.username,
      })
      .returning();
    botTelegramUser = newBotTelegramUser;
  }

  _botTelegramUser = botTelegramUser;
  console.log(`Bot user ${_botTelegramUser.username} initialized in database`);
}

bot
  .use(async (ctx, next) => {
    ctx.botTelegramUser = _botTelegramUser;
    return next();
  })
  .use(async (ctx, next) => {
    if (!ctx.message || !("text" in ctx.message) || !ctx.chat) {
      return;
    }

    // Skip if not from a group
    if (!["group", "supergroup"].includes(ctx.chat.type)) {
      return;
    }

    // Check if group is whitelisted
    if (!whitelist.includes(ctx.chat.id)) {
      return;
    }

    if (!ctx.from?.id) {
      console.warn(`No user id found in message ${ctx.chat.id}`);
      return;
    }

    // Save message to database
    let user: SelectTelegramUsersSchema;
    const [existingUser] = await db
      .select()
      .from(telegramUsersSchema)
      .where(eq(telegramUsersSchema.pub_id, ctx.from.id));
    user = existingUser;

    if (!existingUser) {
      const [newUser] = await db
        .insert(telegramUsersSchema)
        .values({
          pub_id: ctx.from.id,
          username: ctx.from.username,
        })
        .returning();
      user = newUser;
    }

    await db.insert(telegramMessagesSchema).values({
      groupId: ctx.chat.id,
      userId: user.id,
      message: ctx.message.text,
    });

    // Check for bot mention
    const mentions = ctx.message.entities?.filter(
      (entity) => entity.type === "mention",
    );

    if (!mentions?.length) return;

    const botUsername = ctx.botInfo.username;
    const mentionsBot = ctx.message.text
      .slice(mentions[0].offset, mentions[0].offset + mentions[0].length)
      .includes(botUsername!);

    if (!mentionsBot) return;

    return await next();
  })
  .on(message("text"), async (ctx) => {
    const messages = await db
      .select()
      .from(telegramMessagesSchema)
      .where(eq(telegramMessagesSchema.groupId, ctx.chat.id))
      .orderBy(desc(telegramMessagesSchema.createdAt))
      .limit(BOT_MEMORY_WINDOW)
      .innerJoin(
        telegramUsersSchema,
        eq(telegramMessagesSchema.userId, telegramUsersSchema.id),
      );

    const answer = await openAIService.answerQuestion(
      ctx.message.text,
      messages.map(({ telegram_messages, telegram_users }) => ({
        user_id: telegram_users.pub_id,
        user_username: telegram_users.username,
        message: telegram_messages.message,
        createdAt: telegram_messages.createdAt,
      })),
    );
    if (!answer) return;

    await db.insert(telegramMessagesSchema).values({
      groupId: ctx.chat.id,
      userId: ctx.botTelegramUser!.id,
      message: answer,
    });

    return ctx.reply(answer);
  })
  .launch(async () => {
    await initializeBotUser(bot);
    console.log("Bot started.");
  });

process.once("SIGINT", async () => {
  bot.stop("SIGINT");
});

process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
});

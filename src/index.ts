import { Bot, Context, InlineKeyboard } from "grammy";
import { openAIService } from "./modules/openai.js";
import {
  SelectTelegramChatsSchema,
  SelectTelegramUsersSchema,
} from "./schema.js";
import { browserService } from "./modules/browser.js";
import { Telegram, telegramService } from "./modules/telegram.js";
import { memoryService } from "./modules/memory.js";
import { Env } from "./modules/env.js";
import { Config } from "./modules/config.js";

/** Check for either of conditions:
 * 1. Bot is talking to user in private
 * 2. Bot is talking to user in group && bot was mentioned
 */
const shouldAnswer = (ctx: BotContext) => {
  if (ctx.chat?.type === "private") {
    return true;
  }
  if (ctx.chat?.type === "supergroup" || ctx.chat?.type === "group") {
    if (ctx.message?.entities) {
      return ctx.message.entities.some(
        (entity) =>
          entity.type === "mention" &&
          ctx.message?.text?.slice(
            entity.offset,
            entity.offset + entity.length,
          ) === `@${ctx.me?.username}`,
      );
    }
  }
  return false;
};

type BotContext = Context & {
  telegramChat?: SelectTelegramChatsSchema;
  telegramUser?: SelectTelegramUsersSchema;
};

export const bot = new Bot<BotContext>(process.env.TELEGRAM_TOKEN!);

// check if there is a chat at all
bot.use(async (ctx, next) => {
  if (ctx.chat == null || ctx.from == null) {
    return;
  }
  return next();
});

bot.callbackQuery(/approve_chat_(.*)/, async (ctx) => {
  if (!Telegram.isOwnerChat(ctx)) {
    return ctx.reply("You are not authorized to approve chats.");
  }

  const data = ctx.callbackQuery.data;
  const match = data ? data.match(/approve_chat_(.*)/) : null;
  if (!match) {
    console.error(`Invalid callback match: ${data}`);
    return;
  }
  const chatId = +match[1];
  await Telegram.approveChat(chatId);
  bot.api.sendMessage(chatId, "Your chat has been approved!");
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  return ctx.reply("Approved!");
});

bot.callbackQuery(/reject_chat_(.*)/, async (ctx) => {
  if (!Telegram.isOwnerChat(ctx)) {
    return ctx.reply("You are not authorized to reject chats.");
  }

  const data = ctx.callbackQuery.data;
  const match = data ? data.match(/reject_chat_(.*)/) : null;
  if (!match) {
    console.error(`Invalid callback match: ${data}`);
    return;
  }
  const chatId = +match[1];
  await Telegram.rejectChat(chatId);
  bot.api.sendMessage(chatId, "Your chat has been rejected :(");
  await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  return ctx.reply("Rejected!");
});

bot.use(async (ctx, next) => {
  const ownerId = await Config.getConfig("TELEGRAM_BOT_OWNER_CHAT_ID");
  if (ownerId != null) {
    return await next();
  }

  if (
    ctx.chat?.type === "private" &&
    ctx.from?.username === Env.telegramBotOwnerUsername
  ) {
    await Config.setConfig(
      "TELEGRAM_BOT_OWNER_CHAT_ID",
      ctx.chat.id.toString(),
    );
    return await next();
  }

  return;
});

// announce to admin a new chat
bot.use(async (ctx, next) => {
  const chat = await Telegram.getChatByPubId(ctx.chat!.id);
  ctx.telegramChat = chat;

  // approved chat
  if (chat && chat.approved) {
    return await next();
  }

  // pending or unapproved chat
  if (chat) {
    return;
  }

  // new chat
  await Telegram.createChat(ctx.chat!.id);

  const message =
    ctx.chat!.id < 0
      ? `New group chat "${ctx.chat!.title}" (${ctx.chat!.id}) added to the database. Please approve or reject it.`
      : `New private chat with @${ctx.chat!.username} ${ctx.chat!.first_name} ${ctx.chat!.last_name} (${ctx.chat!.id}) added to the database. Please approve or reject it.`;

  const ownerChatId = await Config.getConfig("TELEGRAM_BOT_OWNER_CHAT_ID");
  if (ownerChatId == null) {
    return;
  }

  await bot.api.sendMessage(ownerChatId, message, {
    reply_markup: new InlineKeyboard()
      .text("Approve", `approve_chat_${ctx.chat!.id}`)
      .text("Reject", `reject_chat_${ctx.chat!.id}`),
  });

  return;
});

bot.use(async (ctx, next) => {
  let user: SelectTelegramUsersSchema;
  const existingUser = await Telegram.getUserByPubId(ctx.from!.id);
  user = existingUser;
  if (existingUser == null) {
    const newUser = await Telegram.createUser({
      pubId: ctx.from!.id,
      username: ctx.from!.username,
      firstName: ctx.from!.first_name,
      lastName: ctx.from!.last_name,
    });
    user = newUser;
  }
  ctx.telegramUser = user;
  return await next();
});

bot.use(async (ctx, next) => {
  const message = ctx.message?.text;
  if (message == null) {
    return await next();
  }
  await Telegram.trackMessage({
    chatId: ctx.telegramChat!.id,
    userId: ctx.telegramUser!.id,
    message: message,
  });
  return await next();
});

bot.on("message:text", async (ctx) => {
  const message = ctx.message.text;
  if (message == null) {
    return;
  }

  if (!shouldAnswer(ctx)) {
    return;
  }

  const chatDailyMessages = await telegramService.getDayMessages(
    ctx.telegramChat!.id,
  );
  const chatFewMessages = await telegramService.getLastMessages(
    ctx.telegramChat!.id,
    20,
  );
  const chatMessages =
    chatDailyMessages.length > chatFewMessages.length
      ? chatDailyMessages
      : chatFewMessages;

  const chatMemory = await memoryService.readChatMemory(ctx.telegramChat!.id);

  const answer = await openAIService.answerQuestion(
    `
<content>
${message}
</content>

<context>
  <user>
  ${JSON.stringify({
    id: ctx.from?.id!,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
  })}
  </user>

  <chat-memory>
  ${JSON.stringify(chatMemory)}
  </chat-memory>

  <chat-messages-latest>
  ${JSON.stringify(chatMessages)}
  </chat-messages-latest>
</context>
`,
    [
      {
        definition: {
          type: "function",
          function: {
            name: "get_week_messages",
            description: "Get messages for last 7 days.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
            },
            strict: false,
          },
        },
        callback: () =>
          telegramService
            .getWeekMessages(ctx.telegramChat?.id!)
            .then((messages) => JSON.stringify(messages)),
      },
      {
        definition: {
          type: "function",
          function: {
            name: "get_browser_content",
            description: "Fetch HTML content from a website URL.",
            parameters: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The website URL to fetch HTML content from",
                },
              },
              required: ["url"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        callback: ({ url }: { url: string }) =>
          browserService.getUrlContent(url),
      },
      {
        definition: {
          type: "function",
          function: {
            name: "save_chat_memory_entry",
            description: "Save a memory entry for the chat.",
            parameters: {
              type: "object",
              properties: {
                memory: {
                  type: "string",
                  description: "The memory to save.",
                },
              },
              required: ["memory"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        callback: ({ memory }: { memory: string }) =>
          memoryService
            .saveChatMemoryEntry(ctx.telegramChat?.id!, memory)
            .then(() => "ok"),
      },
      {
        definition: {
          type: "function",
          function: {
            name: "delete_chat_memory_entry",
            description: "Delete a memory entry for the chat.",
            parameters: {
              type: "object",
              properties: {
                entry_id: {
                  type: "number",
                  description: "The ID of the memory entry to delete.",
                },
              },
              required: ["entry_id"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        callback: ({ entry_id }: { entry_id: number }) =>
          memoryService
            .deleteChatMemoryEntry(ctx.telegramChat?.id!, entry_id)
            .then(() => "ok"),
      },
    ],
  );
  if (!answer) return;

  await Telegram.trackMessage({
    chatId: ctx.telegramChat?.id!,
    userId: await Telegram.getBotId(),
    message: answer,
  });

  return ctx.reply(answer);
});

bot.start({
  onStart: async () => {
    console.log("Bot started.");
  },
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

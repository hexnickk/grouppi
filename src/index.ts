import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { openAIService } from "./modules/openai";
import { db } from "./db";
import { telegramChatsSchema, telegramMessagesSchema } from "./schema";
import { eq } from "drizzle-orm";
import { browserService } from "./modules/browser";
import {
  TgBotContext,
  TgRequestContext,
  adminTelegramChatMiddleware,
  botTelegramUserMiddleware,
  telegramChatMiddleware,
  telegramMessagesMiddleware,
  telegramService,
  telegramUserMiddleware,
} from "./modules/telegram";
import { memoryService } from "./modules/memory";

export const bot = new Telegraf<TgBotContext>(process.env.TELEGRAM_TOKEN!);

bot
  // .use(chatTypeMiddleware)
  .use(botTelegramUserMiddleware)
  .use(adminTelegramChatMiddleware)
  .use(telegramUserMiddleware)
  .use(telegramChatMiddleware)
  .use(telegramMessagesMiddleware)
  .action(/approve_chat_(.*)/, async (ctx) => {
    if (ctx.chat?.id !== bot.context.adminTelegramChat?.id) {
      return;
    }
    const chatId = +ctx.match[1];
    await db
      .update(telegramChatsSchema)
      .set({ approved: true })
      .where(eq(telegramChatsSchema.pubId, chatId));

    bot.telegram.sendMessage(chatId, "Your chat has been approved!");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    return ctx.reply("Approved!");
  })
  .action(/reject_chat_(.*)/, async (ctx) => {
    if (ctx.chat?.id !== bot.context.adminTelegramChat?.id) {
      return;
    }
    const chatId = +ctx.match[1];
    await db
      .update(telegramChatsSchema)
      .set({ approved: false })
      .where(eq(telegramChatsSchema.pubId, chatId));
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    return ctx.reply("Rejected!");
  })
  .on(message("text"), async (ctx: TgRequestContext) => {
    if (ctx.chat == null || ctx.message == null || !("text" in ctx.message)) {
      return;
    }
    const answer = await openAIService.answerQuestion(
      `
<user>
${JSON.stringify({
  id: ctx.from?.id!,
  username: ctx.from?.username,
  firstName: ctx.from?.first_name,
  lastName: ctx.from?.last_name,
})}
</user>

<content>
${ctx.message.text}
</content>
`,
      [
        {
          definition: {
            type: "function",
            function: {
              name: "get_last_messages",
              description: "Get the last messages in the chat.",
              parameters: {
                type: "object",
                properties: {
                  count: {
                    type: "number",
                    description: "The number of messages to fetch.",
                    default: 100,
                  },
                },
                required: ["count"],
                additionalProperties: false,
              },
              strict: false,
            },
          },
          callback: ({ count }) =>
            telegramService
              .getLastMessages(ctx.telegramChat?.id!, count)
              .then((messages) => JSON.stringify(messages)),
        },
        {
          definition: {
            type: "function",
            function: {
              name: "get_day_messages",
              description: "Get messages for last 24h.",
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
              .getDayMessages(ctx.telegramChat?.id!)
              .then((messages) => JSON.stringify(messages)),
        },
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
              name: "read_chat_memory",
              description: "Read the memory of the chat.",
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
            memoryService
              .readChatMemory(ctx.telegramChat?.id!)
              .then((memories) => JSON.stringify(memories)),
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

    await db.insert(telegramMessagesSchema).values({
      chatId: ctx.telegramChat?.id!,
      userId: bot.context.botTelegramUser!.id,
      message: answer,
    });

    return ctx.reply(answer);
  })
  .launch(async () => {
    console.log("Bot started.");
  });

process.once("SIGINT", async () => {
  bot.stop("SIGINT");
});

process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
});

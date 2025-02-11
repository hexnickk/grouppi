import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { openAIService } from "./modules/openai";
import { db } from "./db";
import {
  SelectTelegramUsersSchema,
  telegramMessagesSchema,
  telegramUsersSchema,
} from "./schema";
import { eq } from "drizzle-orm";
import { browserService } from "./modules/browser";
import { telegramService } from "./modules/telegram";
import { memoryService } from "./modules/memory";

// Add custom context interface
interface BotContext extends Context {
  botTelegramUser?: SelectTelegramUsersSchema;
}

const whitelist = process.env
  .TELEGRAM_GROUP_ID_WHITELIST!.split(",")
  .map(Number);
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_TOKEN!);

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
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
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
    const answer = await openAIService.answerQuestion(
      `
<user>
${JSON.stringify({ id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name })}
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
              .getLastMessages(ctx.chat.id, count)
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
              .getDayMessages(ctx.chat.id)
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
              .getWeekMessages(ctx.chat.id)
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
              .readChatMemory(ctx.chat.id)
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
              .saveChatMemoryEntry(ctx.chat.id, memory)
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
              .deleteChatMemoryEntry(ctx.chat.id, entry_id)
              .then(() => "ok"),
        },
      ],
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

export namespace Env {
  const getRequired = <T = string>(
    name: string,
    mapper?: (raw: string) => T,
  ): T => {
    const value = process.env[name];
    if (value == null) {
      throw new Error(`${name} is not set.`);
    }
    return mapper ? mapper(value) : (value as unknown as T);
  };

  export const telegramBotOwnerChatId = getRequired(
    "TELEGRAM_BOT_OWNER_CHAT_ID",
    Number,
  );
}

import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { configSchema } from "../schema.js";

export namespace Config {
  let cache: Record<string, string> = {};

  export const getConfig = async (key: string) => {
    if (cache[key]) {
      return cache[key];
    }
    const [entry] = await db
      .select()
      .from(configSchema)
      .where(eq(configSchema.key, key))
      .limit(1);

    if (entry) {
      cache[key] = entry.value;
      return entry.value;
    }

    return undefined;
  };

  export const setConfig = async (key: string, value: string) => {
    await db.insert(configSchema).values({ key, value }).onConflictDoUpdate({
      target: configSchema.key,
      set: { value },
    });
    cache[key] = value;
  };
}

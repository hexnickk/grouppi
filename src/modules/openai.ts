import OpenAI from "openai";
import { browserService } from "./browser";

const prompt1 = `
<goal>
  You are a helpful assistant Grouppi.
</goal>

<rule>
  Don't use any custom formatting as markdown.
</rule>
`;

export class OpenAIService {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  async answerQuestion(
    content: string,
    history: {
      user_id: number;
      user_username?: string | null;
      message: string;
      createdAt: string;
    }[],
    tools?: any[],
  ) {
    let messages: any[] = [
      { role: "system", content: prompt1 },
      {
        role: "user",
        content: `<history>${JSON.stringify(history)}</history>`,
      },
      { role: "user", content },
    ];

    let currentResponse = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: tools ?? [],
      store: true,
      temperature: 0,
    });

    let iteration = 0;
    while (
      iteration < 10 &&
      Array.isArray(currentResponse.choices[0].message.tool_calls) &&
      currentResponse.choices[0].message.tool_calls.length > 0
    ) {
      for (const toolCall of currentResponse.choices[0].message.tool_calls) {
        // TODO: need to pass actual tool_call also as an argument, so this will be function agnostic
        const { url } = JSON.parse(toolCall.function.arguments) as {
          url: string;
        };
        const result = await browserService.getUrlContent(url);

        messages.push(currentResponse.choices[0].message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id || "default",
          content: result.toString(),
        });
      }
      // TODO: need to merge this call with initial call
      currentResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: tools ?? [],
        store: true,
        temperature: 0,
      });
      iteration++;
    }
    return currentResponse.choices[0].message.content || "";
  }
}

export const openAIService = new OpenAIService();

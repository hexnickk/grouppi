import OpenAI from "openai";

const prompt1 = `
- Goals
  - You are a helpful assistant Grouppi.
- Rules
  - Don't use any custom formatting as markdown.
  - Always update memory if there is something important going on.
  - Follow the language of the user.
- Tools
  - You can iterate to call tools up to 10 times.
  - There is no limit of how many tools you can call at once.
`;

interface Tool {
  definition: OpenAI.Chat.ChatCompletionTool;
  callback?: (args: any) => Promise<string>;
}

export class OpenAIService {
  private MAX_TOOL_ITERATIONS = 10;

  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  async answerQuestion(content: string, tools?: Tool[]) {
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: prompt1 },
      { role: "user", content },
    ];

    const toolDefinitions = tools?.map((t) => t.definition) || [];

    let iteration = 0;
    let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    while (true) {
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        // Locate the matching tool by name and ensure it has a callback
        const tool = tools?.find(
          (tool) => tool.definition.function.name === toolCall.function.name,
        );

        if (tool && tool.callback) {
          const result = await tool.callback(args);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id || "default",
            content: result,
          });
        } else {
          console.error(
            `Error: No callback available for ${toolCall.function.name}`,
          );
        }
      }
      let currentResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: toolDefinitions,
        temperature: 0,
      });
      messages.push(currentResponse.choices[0].message);
      toolCalls = currentResponse.choices[0].message.tool_calls || [];
      iteration++;

      if (iteration > this.MAX_TOOL_ITERATIONS || toolCalls.length === 0) {
        break;
      }
    }

    return (messages.at(-1)?.content as string) || "";
  }
}

export const openAIService = new OpenAIService();

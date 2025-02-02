import OpenAI from "openai";

const prompt1 = `
  <goal>
    You are helpful assistant, answer as good as you can.
  </goal>
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
  ) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt1 },
        {
          role: "user",
          content: `<history>${JSON.stringify(history)}</history>`,
        },
        { role: "user", content: content },
      ],
      temperature: 0,
    });
    return response.choices[0].message.content;
  }
}

export const openAIService = new OpenAIService();

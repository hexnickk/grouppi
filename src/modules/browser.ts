import { chromium, Browser } from "playwright";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Compute __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BrowserService {
  private browser: Browser | null = null;

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch();

      process.once("SIGINT", () => this.close());
      process.once("SIGTERM", () => this.close());
    }
    return this.browser;
  }

  private async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async getUrlContent(url: string) {
    const browser = await this.initialize();
    const page = await browser.newPage();
    await page.goto(url);

    // Use computed __dirname to read the evaluated code.
    const filePath = join(__dirname, "./pageEval.js");
    const evaluatedCode = readFileSync(filePath, "utf8");

    const htmlContent = (await page.evaluate(evaluatedCode)) as string;
    await page.close();
    return htmlContent;
  }
}

export const browserService = new BrowserService();

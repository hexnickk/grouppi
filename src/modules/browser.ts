import { chromium, Browser } from "playwright";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptPath = join(__dirname, "./pageEval.js");
const scriptCode = readFileSync(scriptPath, "utf8");

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
    try {
      const browser = await this.initialize();
      const page = await browser.newPage();
      await page.goto(url);

      const htmlContent = (await page.evaluate(scriptCode)) as string;
      await page.close();
      return htmlContent;
    } catch (error) {
      console.error(error);
      return "";
    }
  }
}

export const browserService = new BrowserService();

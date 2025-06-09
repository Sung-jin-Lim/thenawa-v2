import chromium from "@sparticuz/chromium-min";
import puppeteer, { Browser, Page } from "puppeteer-core";

const remoteExecutablePath =
  "https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar";

class BrowserManager {
  private browser: Browser | null = null;
  private isLaunching = false;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.isLaunching) {
      // Wait for the browser to finish launching
      while (this.isLaunching) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.browser && this.browser.connected) {
        return this.browser;
      }
    }

    this.isLaunching = true;

    try {
      console.log("🚀 Launching Puppeteer browser...");

      const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV || process.env.VERCEL;
      console.log(
        `🔧 Environment check - VERCEL: ${process.env.VERCEL}, VERCEL_ENV: ${process.env.VERCEL_ENV}, isVercel: ${isVercel}`
      );

      if (isVercel) {
        console.log(`🚀 Using @sparticuz/chromium-min for Vercel environment`);
        this.browser = await puppeteer.launch({
          args: [
            ...chromium.args,
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-default-apps",
            "--disable-popup-blocking",
            "--disable-translate",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-features=TranslateUI,BlinkGenPropertyTrees",
            "--disable-ipc-flooding-protection",
            "--enable-features=NetworkService,NetworkServiceInProcess",
            "--force-color-profile=srgb",
            "--metrics-recording-only",
            "--use-mock-keychain",
          ],
          executablePath: await chromium.executablePath(remoteExecutablePath),
          headless: true,
          defaultViewport: { width: 1280, height: 800 },
        });
        console.log(`✅ Vercel browser launched with @sparticuz/chromium-min`);
      } else {
        console.log(`🚀 Using local Chrome for development environment`);

        // Local environment: Try to find Chrome
        const possiblePaths = [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
        ];

        let executablePath: string | undefined;
        for (const path of possiblePaths) {
          try {
            const fs = await import("fs");
            if (fs.existsSync(path)) {
              executablePath = path;
              break;
            }
          } catch {
            continue;
          }
        }

        // Chrome을 찾지 못하면 chromium 사용
        if (!executablePath) {
          console.log(`🚀 Local Chrome not found, using @sparticuz/chromium-min fallback`);
          executablePath = await chromium.executablePath(remoteExecutablePath);
        }

        console.log(`🚀 로컬 브라우저 경로: ${executablePath}`);

        this.browser = await puppeteer.launch({
          executablePath,
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-default-apps",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
          defaultViewport: { width: 1280, height: 800 },
        });
      }

      console.log("✅ Browser launched successfully");
      return this.browser;
    } catch (error) {
      console.error("❌ Failed to launch browser:", error);
      throw error;
    } finally {
      this.isLaunching = false;
    }
  }

  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/112.0.0.0 Safari/537.36"
    );

    return page;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log("🔒 Browser closed");
      } catch (error) {
        console.error("❌ Error closing browser:", error);
      }
    }
  }
}

// Singleton instance
export const browserManager = new BrowserManager();

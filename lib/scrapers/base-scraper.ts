import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import type { Browser, Page } from "puppeteer-core";
import { Product } from "@/types/product";

export const dynamic = "force-dynamic";

const remoteExecutablePath =
  "https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar";

let globalBrowser: Browser | null = null;

// 🔥 최적화 1: 더 빠른 브라우저 설정
async function getBrowser(): Promise<Browser> {
  if (globalBrowser) return globalBrowser;

  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

  if (isVercel) {
    globalBrowser = await puppeteer.launch({
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
    });
  } else {
    // 🔥 로컬 환경: Chrome 경로 찾기 로직 복원
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
      try {
        executablePath = await chromium.executablePath(remoteExecutablePath);
      } catch (error) {
        console.error("Chrome 또는 Chromium을 찾을 수 없습니다:", error);
        throw new Error("브라우저 실행 파일을 찾을 수 없습니다. Chrome을 설치해주세요.");
      }
    }

    console.log(`🚀 로컬 브라우저 경로: ${executablePath}`);

    globalBrowser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-images", // 🔥 이미지 로딩 비활성화로 속도 향상
      ],
    });
  }

  return globalBrowser;
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  abstract sourceName: string;
  abstract baseUrl: string;

  async initialize(): Promise<void> {
    this.browser = await getBrowser();
    this.page = await this.browser.newPage();

    // 🔥 최적화 2: 초고속 페이지 설정
    await Promise.all([
      // 리소스 차단으로 속도 향상
      this.page.setRequestInterception(true),
      // 더 작은 뷰포트
      this.page.setViewport({ width: 360, height: 640 }),
      // 빠른 User-Agent
      this.page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15"
      ),
    ]);

    // 🔥 최적화 3: 불필요한 리소스 차단
    this.page.on("request", (request) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // 이미지, 폰트, CSS 등 차단하여 속도 향상
      if (
        resourceType === "image" ||
        resourceType === "font" ||
        resourceType === "stylesheet" ||
        url.includes("google-analytics") ||
        url.includes("gtm") ||
        url.includes("facebook") ||
        url.includes("doubleclick")
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // 🔥 최적화 4: 매우 짧은 타임아웃
    this.page.setDefaultTimeout(5000); // 5초로 단축
    this.page.setDefaultNavigationTimeout(8000); // 8초로 단축
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
        this.page = null;
      }
    } catch {
      this.page = null;
    }
    // 🔥 브라우저는 재사용을 위해 닫지 않음
  }

  // 🔥 최적화 5: 초고속 스크롤 (기존 autoScroll 대체)
  async fastScroll(): Promise<void> {
    if (!this.page) return;

    try {
      // 3번만 빠르게 스크롤
      await this.page.evaluate(() => {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, window.innerHeight * 0.8);
        }
      });

      // 1초만 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`${this.sourceName} 고속 스크롤 실패:`, error);
    }
  }

  // 🔥 최적화 6: 기존 mobileScroll을 더 빠르게
  async mobileScroll(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluate(() => {
        // 2번만 스크롤, 간격도 짧게
        let scrollCount = 0;
        const maxScrolls = 2;

        const scrollStep = () => {
          if (scrollCount < maxScrolls) {
            window.scrollBy(0, window.innerHeight * 0.8);
            scrollCount++;
            setTimeout(scrollStep, 500); // 0.5초 간격으로 단축
          }
        };

        scrollStep();
      });

      // 1.5초만 대기
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.warn(`${this.sourceName} 모바일 스크롤 실패:`, error);
    }
  }

  // 기존 autoScroll을 고속 버전으로 대체
  async autoScroll(): Promise<void> {
    return this.fastScroll();
  }

  abstract searchProducts(query: string, limit?: number): Promise<Product[]>;
}

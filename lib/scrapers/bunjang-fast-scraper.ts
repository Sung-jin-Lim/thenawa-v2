import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";

export class BunjangFastScraper extends BaseScraper {
  sourceName = "bunjang";
  baseUrl = "https://www.bunjang.co.kr";

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    // 🚀 Skip HTTP fetch and go straight to optimized Puppeteer
    // Bunjang blocks HTTP requests, so we focus on optimizing browser automation
    return this.tryOptimizedPuppeteer(query, limit);
  }

  private async tryOptimizedPuppeteer(query: string, limit: number): Promise<Product[]> {
    const startTime = Date.now();
    const products: Product[] = [];
    let page = null;

    try {
      // 🚀 Create page from shared browser (faster than new browser)
      page = await browserManager.createPage();

      // 🚀 Minimal page setup for speed
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
      );

      // 🚀 Aggressive resource blocking for Vercel performance
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const resourceType = req.resourceType();
        const url = req.url();

        // 🚀 Block more resources in Vercel for speed
        const isVercel = process.env.VERCEL === "1";
        if (isVercel) {
          if (
            resourceType === "image" ||
            resourceType === "stylesheet" ||
            resourceType === "font" ||
            resourceType === "media" ||
            url.includes("google-analytics") ||
            url.includes("googletagmanager") ||
            url.includes("facebook.net") ||
            url.includes("doubleclick.net")
          ) {
            req.abort();
          } else {
            req.continue();
          }
        } else {
          // Original blocking for local development
          if (
            resourceType === "image" ||
            resourceType === "stylesheet" ||
            resourceType === "font"
          ) {
            req.abort();
          } else {
            req.continue();
          }
        }
      });

      const searchUrl = `${this.baseUrl}/search/products?q=${encodeURIComponent(query)}`;
      console.log(`🔍 번개장터 검색: ${searchUrl}`);

      // 🚀 Faster navigation - optimized for environment
      const isVercel = process.env.VERCEL === "1";
      const navigationTimeout = isVercel ? 15000 : 8000; // Longer timeout for Vercel serverless

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded", // Much faster than networkidle
        timeout: navigationTimeout,
      });

      // 🚀 Quick selector wait with short timeout
      try {
        await page.waitForSelector("a[data-pid]", { timeout: 3000 });
        console.log("✅ 번개장터 a[data-pid] 선택자 발견!");
      } catch {
        // Don't wait long - just continue
        console.log("⚠️ 번개장터 선택자 빠른 실패, 계속 진행...");
      }

      const html = await page.content();
      const $ = cheerio.load(html);

      // Find products using the known working selector
      const productCards = $("a[data-pid]");
      console.log(`🎯 번개장터 상품 카드 발견: ${productCards.length}개`);

      if (productCards.length === 0) {
        console.log("❌ 번개장터: 상품을 찾을 수 없음");
        return [];
      }

      productCards.slice(0, limit).each((index, element) => {
        try {
          const card = $(element);

          const title =
            card.find("div.sc-RcBXQ").text().trim() ||
            card.find('[class*="title"]').text().trim() ||
            card.find("h3, h4, h5").text().trim() ||
            card.text().trim().split("\n")[0] ||
            "";

          let priceText =
            card.find("div.sc-iSDuPN").text().trim() ||
            card.find('[class*="price"]').text().trim() ||
            "";

          if (!priceText) {
            const fullText = card.text().trim();
            const priceMatch = fullText.match(/(\d{1,3}(?:,\d{3})*원?|\d+원)/);
            if (priceMatch) {
              priceText = priceMatch[0];
            }
          }

          const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, ""), 10) || 0 : 0;

          let imageUrl =
            card.find("img").attr("data-original") ||
            card.find("img").attr("src") ||
            card.find("img").attr("data-src") ||
            "";
          if (imageUrl.startsWith("//")) {
            imageUrl = "https:" + imageUrl;
          }

          const href = card.attr("href") || "";
          const productUrl = href.startsWith("http") ? href : this.baseUrl + href;

          // Validate product
          if (
            title &&
            title.length > 2 &&
            !title.includes("판매하기") &&
            !title.includes("로그인") &&
            !title.includes("회원가입") &&
            !title.includes("번개장터") &&
            productUrl &&
            productUrl.includes("bunjang")
          ) {
            const product: Product = {
              id: `bunjang-fast-${index}-${Date.now()}`,
              title: title.substring(0, 100).trim(),
              price,
              priceText: priceText || "가격 문의",
              source: "bunjang" as const,
              productUrl,
              imageUrl: imageUrl || "",
              location: "번개장터",
              timestamp: new Date().toISOString(),
              description: `번개장터에서 판매 중인 ${title}`,
            };

            products.push(product);
            console.log(
              `✅ 번개장터 상품 추가: ${title} - ${priceText} (이미지: ${
                imageUrl ? "있음" : "없음"
              })`
            );
          }
        } catch (error) {
          console.error(`❌ 번개장터 상품 파싱 오류:`, error);
        }
      });

      console.log(`🎯 번개장터 최종 결과: ${products.length}개 상품`);
      console.log(`⚡ 번개장터 최적화 완료: ${Date.now() - startTime}ms`);

      return products.slice(0, limit);
    } catch (error) {
      console.error("❌ 번개장터 최적화 스크래핑 오류:", error);
      return [];
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error("❌ Error closing Bunjang page:", e);
        }
      }
    }
  }
}

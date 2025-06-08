import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";
import type { Page } from "puppeteer";

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

export class DanggeunScraper extends BaseScraper {
  sourceName = "danggeun";
  baseUrl = "https://www.daangn.com";
  searchPath = "/kr/buy-sell/";
  region = "용답동-70"; // Default region

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    const products: Product[] = [];
    let page = null;

    try {
      // 🚀 Create page from shared browser
      page = await browserManager.createPage();

      // 🔥 당근마켓 검색 URL (exact same as example)
      const url = `${this.baseUrl}${this.searchPath}?in=${encodeURIComponent(
        this.region
      )}&search=${encodeURIComponent(query)}`;
      console.log(`🔍 당근마켓 검색: ${url}`);

      // Navigate to search page
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

      // Wait for search results (exact selector from example)
      await page.waitForSelector('a[data-gtm="search_article"]', { timeout: 15000 });

      // Scroll through the page to trigger lazy-load (from example)
      await autoScroll(page);

      // Short pause to let images load (from example)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get HTML and parse with Cheerio
      const html = await page.content();
      console.log(`📄 당근마켓 HTML 길이: ${html.length}`);

      const $ = cheerio.load(html);

      // Use exact selector from example
      const articleElements = $('a[data-gtm="search_article"]');
      console.log(`🎯 당근마켓 상품 요소 발견: ${articleElements.length}개`);

      if (articleElements.length === 0) {
        console.log(`❌ 당근마켓: 상품 요소를 찾을 수 없음`);
        return [];
      }

      articleElements.slice(0, limit).each((index, element) => {
        try {
          const card = $(element);

          // Extract data using exact selectors from example
          const title = card.find("span.lm809sh").text().trim();
          const priceTxt = card.find("span.lm809si").text().trim();
          const price = parseInt(priceTxt.replace(/[^0-9]/g, ""), 10) || 0;
          const location = card.find("span.lm809sj").first().text().trim();

          // Enhanced image extraction for Danggeun (exact from example)
          let img = "";

          // Try multiple selectors for images (from example)
          const imageSelectors = [
            'img[src*="daangn"]',
            'img[src*="karrot"]',
            'img[src*="gcp-karroter"]',
            'img[data-src*="daangn"]',
            'img[data-src*="karrot"]',
            'img[data-src*="gcp-karroter"]',
            "img", // fallback
          ];

          for (const selector of imageSelectors) {
            const imgEl = card.find(selector).first();
            if (imgEl.length) {
              img = imgEl.attr("src") || imgEl.attr("data-src") || "";
              if (
                img &&
                (img.includes("daangn") ||
                  img.includes("karrot") ||
                  img.includes("gcp-karroter")) &&
                !img.includes("avatar") &&
                !img.includes("icon") &&
                !img.includes("logo") &&
                !img.includes("profile")
              ) {
                break;
              }
            }
          }

          // Clean up image URL (from example)
          if (img) {
            if (img.startsWith("//")) {
              img = "https:" + img;
            } else if (img.startsWith("/")) {
              img = "https://www.daangn.com" + img;
            }
          }

          const relUrl = card.attr("href");
          const productUrl = this.baseUrl + relUrl;

          // Only add if we have title and URL (from example logic)
          if (title && productUrl) {
            const product: Product = {
              id: `danggeun-${index}-${Date.now()}`,
              title: title.substring(0, 100).trim(),
              price,
              priceText: priceTxt || "가격 문의",
              source: "danggeun" as const,
              productUrl,
              imageUrl: img || "",
              location: location.substring(0, 50).trim() || "당근마켓",
              timestamp: new Date().toISOString(),
              description: `당근마켓에서 판매 중인 ${title}`,
            };

            products.push(product);
            console.log(
              `✅ 당근마켓 상품 추가: ${title} - ${priceTxt} (이미지: ${img ? "있음" : "없음"})`
            );
          }
        } catch (error) {
          console.error(`❌ 당근마켓 상품 파싱 오류:`, error);
        }
      });

      console.log(`🎯 당근마켓 최종 결과: ${products.length}개 상품`);
      return products.slice(0, limit);
    } catch (error) {
      console.error(`❌ 당근마켓 스크래핑 오류:`, error);
      return [];
    } finally {
      // Always close the page
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error("❌ Error closing Danggeun page:", e);
        }
      }
    }
  }
}

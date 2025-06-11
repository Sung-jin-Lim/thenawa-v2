import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";

export class BunjangScraper extends BaseScraper {
  sourceName = "bunjang";
  baseUrl = "https://www.bunjang.co.kr";

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    const products: Product[] = [];
    let page = null;

    try {
      // 🚀 Create page from shared browser
      page = await browserManager.createPage();

      // Set user agent and viewport (from working example)
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/112.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1280, height: 800 });

      // 🔥 번개장터 검색 URL (exact same as working example)
      const searchUrl = `${this.baseUrl}/search/products?q=${encodeURIComponent(query)}`;
      console.log(`🔍 번개장터 검색: ${searchUrl}`);

      // Navigate with domcontentloaded (faster than networkidle2)
      await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

      // Wait for the primary selector (from working example)
      try {
        await page.waitForSelector("a[data-pid]", { timeout: 10000 });
        console.log("✅ 번개장터 a[data-pid] 선택자 발견!");
      } catch {
        console.log("⚠️ 번개장터 a[data-pid] 선택자 대기 실패, 다른 방법 시도...");
        // Wait a bit for page to stabilize instead of waiting for specific selector
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Get HTML and parse with Cheerio
      const html = await page.content();
      console.log(`📄 번개장터 HTML 길이: ${html.length}`);

      const $ = cheerio.load(html);

      // Try multiple selectors to find products (prioritize working selector from example)
      const selectors = [
        "a[data-pid]", // ⭐ This is the PRIMARY working selector from example!
        'a[href*="/product/"]',
        ".product-item",
        ".item-card",
        'div[class*="product"]',
        'div[class*="item"]',
        'a[href*="/products/"]', // Move this to the end as it's finding wrong elements
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let productCards: cheerio.Cheerio<any> | null = null;
      let usedSelector = "";

      console.log(`🔍 번개장터 HTML 미리보기 (처음 500자): ${html.substring(0, 500)}`);

      for (const selector of selectors) {
        const cards = $(selector);
        console.log(`🔍 번개장터 선택자 테스트: ${selector} → ${cards.length}개 요소`);
        if (cards.length > 0) {
          productCards = cards;
          usedSelector = selector;
          console.log(`✅ 번개장터 선택자 성공: ${selector} (${cards.length}개 요소)`);
          break;
        }
      }

      if (!productCards || productCards.length === 0) {
        console.log(`❌ 번개장터: 상품 요소를 찾을 수 없음`);
        console.log(`🔍 번개장터 페이지 모든 링크 (처음 10개):`);
        $("a")
          .slice(0, 10)
          .each((i, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim().substring(0, 50);
            console.log(`  ${i}: ${href} - "${text}"`);
          });
        return [];
      }

      console.log(`🎯 번개장터 상품 카드 발견: ${productCards.length}개 (선택자: ${usedSelector})`);

      productCards.slice(0, limit).each((index, element) => {
        try {
          const card = $(element);

          // Extract data with fallback methods
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const pid = card.attr("data-pid") || `bunjang-${index}`;

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

          // If no price found, look for price patterns in text
          if (!priceText) {
            const fullText = card.text().trim();
            const priceMatch = fullText.match(/(\d{1,3}(?:,\d{3})*원?|\d+원)/);
            if (priceMatch) {
              priceText = priceMatch[0];
            }
          }

          const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, ""), 10) || 0 : 0;

          // Image extraction (exact method from working example)
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

          // Improved validation to exclude navigation elements
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
              id: `bunjang-${index}-${Date.now()}`,
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
      return products.slice(0, limit);
    } catch (error) {
      console.error(`❌ 번개장터 스크래핑 오류:`, error);
      return [];
    } finally {
      // Always close the page
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

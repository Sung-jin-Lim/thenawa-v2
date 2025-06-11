import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";
import type { Page } from "puppeteer-core";

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
  region = "마장동-56"; // Default region

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    const products: Product[] = [];
    let page = null;

    try {
      // 🚀 Create page from shared browser
      page = await browserManager.createPage();

      // 🔥 당근마켓 검색 URL (exact same as example)
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}${this.searchPath}?in=${encodeURIComponent(
        this.region
      )}&search=${encodedQuery}`;
      console.log(`🔍 당근마켓 검색: ${url}`);

      // Navigate to search page with Vercel-friendly timeout
      const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: isVercel ? 25000 : 15000, // 25초 for Vercel, 15초 for local
      });

      console.log(`🔍 당근마켓 선택자 대기 중...`);

      // Wait for any content to load - reduced wait time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try both selectors quickly
      const selectors = ['a[data-gtm="search_article"]', 'a[href*="/kr/buy-sell/"]'];
      let foundSelector = "";

      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1500 });
          foundSelector = selector;
          console.log(`✅ 당근마켓 선택자 발견: ${selector}`);
          break;
        } catch {
          console.log(`⏰ 당근마켓 선택자 타임아웃: ${selector}`);
        }
      }

      if (!foundSelector) {
        // Don't give up immediately - continue to parsing
        console.log(`⚠️ 당근마켓: 선택자 대기 실패, 파싱 강행`);
        foundSelector = "FALLBACK";
      }

      // Scroll through the page to trigger lazy-load (from example)
      await autoScroll(page);

      // Short pause to let images load (from example)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get HTML and parse with Cheerio
      const html = await page.content();
      console.log(`📄 당근마켓 HTML 길이: ${html.length}`);

      const $ = cheerio.load(html);

      // Try multiple selectors for finding products (prioritize the working one)
      const productSelectors = [
        'a[data-gtm="search_article"]', // ⭐ This WORKS when found - prioritize it!
        'a[href*="/kr/buy-sell/"]', // Alternative approach
        'a[href*="/articles/"]', // Fallback
        'div[class*="article"]', // Container fallback
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let articleElements: cheerio.Cheerio<any> | null = null;
      let usedSelector = "";

      for (const selector of productSelectors) {
        const elements = $(selector);
        console.log(`🔍 당근마켓 선택자 테스트: ${selector} → ${elements.length}개 요소`);
        if (elements.length > 0) {
          articleElements = elements;
          usedSelector = selector;
          console.log(`✅ 당근마켓 선택자 성공: ${selector} (${elements.length}개 요소)`);
          break;
        }
      }

      if (!articleElements || articleElements.length === 0) {
        console.log(`❌ 당근마켓: 상품 요소를 찾을 수 없음`);
        console.log(`🔍 당근마켓 페이지 모든 링크 (처음 10개):`);
        $("a")
          .slice(0, 10)
          .each((i, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim().substring(0, 50);
            const dataGtm = $(el).attr("data-gtm");
            console.log(`  ${i}: ${href} - "${text}" (data-gtm: ${dataGtm})`);
          });
        return [];
      }

      console.log(
        `🎯 당근마켓 상품 요소 발견: ${articleElements.length}개 (선택자: ${usedSelector})`
      );

      articleElements.slice(0, limit).each((index, element) => {
        try {
          const card = $(element);
          let title = "";
          let priceTxt = "";
          let location = "당근마켓";

          // Use different parsing logic based on the selector used
          if (usedSelector === 'a[data-gtm="search_article"]') {
            // Original working parsing logic for data-gtm selector
            title = card.find("span").first().text().trim(); // Try first span for title
            if (!title) {
              title = card.text().split("\n")[0].trim(); // Fallback to first line
            }

            // Look for price in spans or text
            const spans = card.find("span");
            spans.each((i, span) => {
              const spanText = $(span).text().trim();
              if (/\d+[,.]?\d*원/.test(spanText)) {
                priceTxt = spanText;
                return false; // Break from each loop
              }
            });

            // Look for location
            spans.each((i, span) => {
              const spanText = $(span).text().trim();
              if (
                spanText &&
                spanText !== title &&
                spanText !== priceTxt &&
                !spanText.includes("·")
              ) {
                location = spanText;
                return false;
              }
            });
          } else {
            // Alternative parsing for href-based selectors
            const fullText = card.text().trim();

            // Split by common separators and try to extract info
            const parts = fullText.split(/[\n\r]+/).filter((part) => part.trim());

            if (parts.length >= 2) {
              title = parts[0].trim(); // First part is usually the title
              priceTxt = parts[1].trim(); // Second part is usually the price

              // Look for location in the remaining parts
              for (let i = 2; i < parts.length; i++) {
                const part = parts[i].trim();
                if (part && !part.includes("·") && !part.includes("전") && !part.includes("끌올")) {
                  location = part;
                  break;
                }
              }
            } else {
              // Fallback: try to extract from the full text
              title = fullText.replace(/\d+[,.]?\d*원?|\d+[,.]?\d*만원?|마장동|·.*$/g, "").trim();
              const priceMatch = fullText.match(/(\d+[,.]?\d*(?:원|만원)?)/);
              if (priceMatch) {
                priceTxt = priceMatch[1];
              }
            }
          }

          // Clean up title
          if (title.length > 100) {
            title = title.substring(0, 100).trim();
          }

          // Extract price number
          const price = parseInt(priceTxt.replace(/[^0-9]/g, ""), 10) || 0;

          // Extract image from the link
          let img = "";
          const imgEl = card.find("img").first();
          if (imgEl.length) {
            let imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || "";

            if (imgSrc) {
              // Clean up the URL
              if (imgSrc.startsWith("//")) {
                imgSrc = "https:" + imgSrc;
              } else if (imgSrc.startsWith("/")) {
                imgSrc = "https://www.daangn.com" + imgSrc;
              }

              // Danggeun images are usually valid if they exist
              if (imgSrc.length > 10 && !imgSrc.includes("placeholder")) {
                img = imgSrc;
              }
            }
          }

          let relUrl = card.attr("href");
          if (!relUrl && usedSelector.includes("a")) {
            // If we're not on an anchor tag, try to find one inside
            const linkEl = card.find("a").first();
            relUrl = linkEl.attr("href");
          }

          let productUrl = "";
          if (relUrl) {
            if (relUrl.startsWith("http")) {
              productUrl = relUrl; // Already full URL
            } else if (relUrl.startsWith("/")) {
              productUrl = this.baseUrl + relUrl; // Relative URL
            } else {
              productUrl = this.baseUrl + "/" + relUrl; // Path without leading slash
            }
          }

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

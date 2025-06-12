import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";

export class DanggeunFastScraper extends BaseScraper {
  sourceName = "danggeun";
  baseUrl = "https://www.daangn.com";
  region = "마장동-56"; // Default region, can be configurable

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    // 🚀 Strategy 1: Try fast fetch approach first
    const fetchResults = await this.tryFetchApproach(query, limit);

    if (fetchResults.length > 0) {
      console.log(`🚀 당근마켓 Fast-Fetch 성공: ${fetchResults.length}개 상품 (초고속)`);
      return fetchResults;
    }

    console.log(`⚠️ Fast-Fetch 실패, Puppeteer 폴백 시도...`);

    // 🤖 Strategy 2: Fallback to Puppeteer if fetch fails
    return await this.tryPuppeteerApproach(query, limit);
  }

  private async tryFetchApproach(query: string, limit: number): Promise<Product[]> {
    try {
      const startTime = Date.now();
      const searchUrl = `${this.baseUrl}/kr/buy-sell/?in=${encodeURIComponent(
        this.region
      )}&search=${encodeURIComponent(query)}`;

      console.log(`🔍 당근마켓 Fast-Fetch: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        console.log(`❌ 당근마켓 HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();
      const fetchTime = Date.now() - startTime;

      console.log(`📄 당근마켓 HTML 수신: ${html.length.toLocaleString()} bytes (${fetchTime}ms)`);

      // Quick validation - check if we got meaningful content
      const hasProducts = html.includes("lm809sh") || html.includes('data-gtm="search_article"');
      const hasBlocking =
        html.includes("차단") || html.includes("robot") || html.includes("captcha");

      if (!hasProducts) {
        console.log(`❌ 당근마켓 상품 데이터 없음`);
        return [];
      }

      if (hasBlocking) {
        console.log(`⚠️ 당근마켓 차단 감지, Puppeteer 필요할 수 있음`);
        // Still try to extract, sometimes it works despite detection
      }

      const products: Product[] = [];

      // Extract products using regex to find complete article links with all data
      // Pattern to match the full <a> tag with data-gtm="search_article"
      const articleRegex =
        /<a[^>]*data-gtm="search_article"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

      let articleMatch;
      let productCount = 0;

      while ((articleMatch = articleRegex.exec(html)) !== null && productCount < limit) {
        const href = articleMatch[1];
        const articleContent = articleMatch[2];

        // Extract title from article content
        const titleMatch = articleContent.match(/class="[^"]*lm809sh[^"]*"[^>]*>([^<]+)</);
        const title = titleMatch ? titleMatch[1].trim() : "";

        // Extract price from article content
        const priceMatch = articleContent.match(/class="[^"]*lm809si[^"]*"[^>]*>([^<]+)</);
        const priceText = priceMatch ? priceMatch[1].trim() : "가격 문의";

        // Extract location from article content
        const locationMatch = articleContent.match(/class="[^"]*lm809sj[^"]*"[^>]*>([^<]+)</);
        const location = locationMatch ? locationMatch[1].trim() : this.region.replace("-56", "");

        // Extract image URL from article content
        let imageUrl = "";
        const imagePatterns = [
          /src="([^"]*(?:daangn|karrot|gcp-karroter)[^"]*)"/, // src with dangn/karrot domains
          /data-src="([^"]*(?:daangn|karrot|gcp-karroter)[^"]*)"/, // data-src with domains
          /src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/, // any image file extensions
          /data-src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/, // data-src with extensions
        ];

        for (const pattern of imagePatterns) {
          const imgMatch = articleContent.match(pattern);
          if (imgMatch) {
            let img = imgMatch[1];
            // Skip unwanted images
            if (
              !img.includes("avatar") &&
              !img.includes("icon") &&
              !img.includes("logo") &&
              !img.includes("profile")
            ) {
              // Fix relative URLs
              if (img.startsWith("//")) {
                img = "https:" + img;
              } else if (img.startsWith("/")) {
                img = this.baseUrl + img;
              }
              imageUrl = img;
              break;
            }
          }
        }

        if (title && title.length > 3) {
          const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

          // Build the complete product URL
          const productUrl = href.startsWith("/") ? `${this.baseUrl}${href}` : href;

          const product: Product = {
            id: `danggeun-fast-${productCount}-${Date.now()}`,
            title: title.substring(0, 100),
            price,
            priceText,
            source: "danggeun" as const,
            productUrl,
            imageUrl,
            location,
            timestamp: new Date().toISOString(),
            description: `당근마켓에서 판매 중인 ${title}`,
          };

          products.push(product);
          productCount++;

          console.log(
            `✅ 당근마켓 Fast-Extract [${productCount}]: ${title} (${priceText}) - URL: ${productUrl} - 이미지: ${
              imageUrl ? "있음" : "없음"
            }`
          );
        }
      }

      console.log(`🎯 당근마켓 Fast-Extract 완료: ${products.length}개 상품`);

      // If the regex approach didn't work well, fallback to the old method but with better URL extraction
      if (products.length === 0) {
        console.log(`⚠️ Regex 방식 실패, 개별 추출 시도...`);

        const titleRegex = /class="[^"]*lm809sh[^"]*"[^>]*>([^<]+)</g;
        const priceRegex = /class="[^"]*lm809si[^"]*"[^>]*>([^<]+)</g;
        const urlRegex = /href="([^"]*buy-sell[^"]*)"/g;

        let titleMatch;
        const titles: string[] = [];
        while ((titleMatch = titleRegex.exec(html)) !== null && titles.length < limit) {
          const title = titleMatch[1].trim();
          if (title && title.length > 3) {
            titles.push(title);
          }
        }

        let priceMatch;
        const prices: string[] = [];
        while ((priceMatch = priceRegex.exec(html)) !== null && prices.length < limit) {
          const priceText = priceMatch[1].trim();
          if (priceText) {
            prices.push(priceText);
          }
        }

        let urlMatch;
        const urls: string[] = [];
        while ((urlMatch = urlRegex.exec(html)) !== null && urls.length < limit) {
          const url = urlMatch[1].trim();
          if (url && url.includes("buy-sell")) {
            const fullUrl = url.startsWith("/") ? `${this.baseUrl}${url}` : url;
            urls.push(fullUrl);
          }
        }

        // Extract images
        const imageRegex =
          /(?:src|data-src)="([^"]*(?:daangn|karrot|gcp-karroter|\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/g;
        let imageMatch;
        const images: string[] = [];
        while ((imageMatch = imageRegex.exec(html)) !== null && images.length < limit) {
          let img = imageMatch[1];
          if (
            !img.includes("avatar") &&
            !img.includes("icon") &&
            !img.includes("logo") &&
            !img.includes("profile")
          ) {
            if (img.startsWith("//")) {
              img = "https:" + img;
            } else if (img.startsWith("/")) {
              img = this.baseUrl + img;
            }
            images.push(img);
          }
        }

        console.log(
          `🎯 당근마켓 개별 추출: ${titles.length}개 제목, ${prices.length}개 가격, ${urls.length}개 URL, ${images.length}개 이미지`
        );

        // Match titles with prices and URLs
        for (let i = 0; i < Math.min(titles.length, limit); i++) {
          const title = titles[i];
          const priceText = prices[i] || "가격 문의";
          const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;
          const productUrl =
            urls[i] || `${this.baseUrl}/kr/buy-sell/?search=${encodeURIComponent(title)}`;
          const imageUrl = images[i] || "";

          const product: Product = {
            id: `danggeun-fast-fallback-${i}-${Date.now()}`,
            title: title.substring(0, 100),
            price,
            priceText,
            source: "danggeun" as const,
            productUrl,
            imageUrl,
            location: this.region.replace("-56", ""),
            timestamp: new Date().toISOString(),
            description: `당근마켓에서 판매 중인 ${title}`,
          };

          products.push(product);
        }
      }

      if (products.length > 0) {
        console.log(
          `✅ 당근마켓 Fast-Fetch 성공: ${products.length}개 (${Date.now() - startTime}ms)`
        );
        return products;
      }

      return [];
    } catch (error) {
      console.error(`❌ 당근마켓 Fast-Fetch 오류:`, error);
      return [];
    }
  }

  private async tryPuppeteerApproach(query: string, limit: number): Promise<Product[]> {
    let page = null;

    try {
      const startTime = Date.now();
      console.log(`🤖 당근마켓 Puppeteer 폴백 시작`);

      page = await browserManager.createPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      const searchUrl = `${this.baseUrl}/kr/buy-sell/?in=${encodeURIComponent(
        this.region
      )}&search=${encodeURIComponent(query)}`;

      console.log(`🔍 당근마켓 검색: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 15000 });

      console.log(`🔍 당근마켓 선택자 대기 중...`);
      await page.waitForSelector('a[data-gtm="search_article"]', { timeout: 15000 });

      console.log(`✅ 당근마켓 선택자 발견: a[data-gtm="search_article"]`);

      const html = await page.content();
      const $ = cheerio.load(html);

      console.log(`📄 당근마켓 HTML 길이: ${html.length}`);

      const products: Product[] = [];
      const selector = 'a[data-gtm="search_article"]';

      $(selector).each((i, el) => {
        if (i >= limit) return false;

        const card = $(el);
        const title = card.find("span.lm809sh").text().trim();
        const priceTxt = card.find("span.lm809si").text().trim();
        const price = parseInt(priceTxt.replace(/[^0-9]/g, ""), 10) || 0;
        const location = card.find("span.lm809sj").first().text().trim();

        // Enhanced image extraction
        let img = "";
        const imageSelectors = [
          'img[src*="daangn"]',
          'img[src*="karrot"]',
          'img[src*="gcp-karroter"]',
          'img[data-src*="daangn"]',
          'img[data-src*="karrot"]',
          'img[data-src*="gcp-karroter"]',
          "img",
        ];

        for (const selector of imageSelectors) {
          const imgEl = card.find(selector).first();
          if (imgEl.length) {
            img = imgEl.attr("src") || imgEl.attr("data-src") || "";
            if (
              img &&
              (img.includes("daangn") || img.includes("karrot") || img.includes("gcp-karroter")) &&
              !img.includes("avatar") &&
              !img.includes("icon") &&
              !img.includes("logo") &&
              !img.includes("profile")
            ) {
              break;
            }
          }
        }

        // Clean up image URL
        if (img) {
          if (img.startsWith("//")) {
            img = "https:" + img;
          } else if (img.startsWith("/")) {
            img = "https://www.daangn.com" + img;
          }
        }

        const relUrl = card.attr("href");
        const productUrl = this.baseUrl + relUrl;

        if (title && productUrl) {
          const product: Product = {
            id: `danggeun-${i}-${Date.now()}`,
            title,
            price,
            priceText: priceTxt,
            source: "danggeun" as const,
            productUrl,
            imageUrl: img,
            location,
            timestamp: new Date().toISOString(),
            description: `당근마켓에서 판매 중인 ${title}`,
          };

          products.push(product);

          console.log(
            `✅ 당근마켓 상품 추가 [${i}]: ${title}${priceTxt}${location} - ${price.toLocaleString()}원 (이미지: ${
              img ? "있음" : "없음"
            })`
          );
        }
      });

      const puppeteerTime = Date.now() - startTime;
      console.log(`🎯 당근마켓 최종 결과: ${products.length}개 상품`);
      console.log(`✅ 당근마켓 완료: ${products.length}개 (${puppeteerTime}ms)`);

      return products;
    } catch (error) {
      console.error(`❌ 당근마켓 Puppeteer 오류:`, error);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
}

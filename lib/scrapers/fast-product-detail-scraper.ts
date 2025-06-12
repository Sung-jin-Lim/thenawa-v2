import { Product } from "@/types/product";
import * as cheerio from "cheerio";

export interface ProductDetail extends Product {
  description: string;
  condition: string;
  sellerName: string;
  additionalImages: string[];
  specifications: Record<string, string>;
  tags: string[];
  location?: string;
}

export class FastProductDetailScraper {
  private readonly timeout = 8000; // 8 second timeout per product

  async scrapeProductsDetails(
    products: Array<{
      id: string;
      title: string;
      price: number;
      priceText: string;
      source: string;
      imageUrl: string;
      productUrl: string;
    }>
  ): Promise<ProductDetail[]> {
    console.log(`🚀 Fast 상세 정보 수집 시작: ${products.length}개 제품 (병렬 처리)`);
    const startTime = Date.now();

    // Process all products in parallel for maximum speed
    const detailPromises = products.map(async (product, index) => {
      try {
        console.log(`📦 [${index + 1}/${products.length}] 상세 정보 수집: ${product.title}`);

        // Try fast-fetch first, fallback to Puppeteer if needed
        const detail = await this.scrapeProductDetailFast(product.productUrl, product.source);

        if (detail && this.isValidDetail(detail)) {
          return detail;
        } else {
          console.log(
            `⚠️ Fast-fetch 실패, 원본 데이터 사용: ${product.title} - 이미지: ${
              product.imageUrl ? "있음" : "없음"
            }`
          );
          // Return enhanced version of original product data
          return this.createFallbackDetail(product);
        }
      } catch (error) {
        console.error(`❌ 상품 상세 정보 수집 실패: ${product.title}`, error);
        return this.createFallbackDetail(product);
      }
    });

    const results = await Promise.all(detailPromises);
    const totalTime = Date.now() - startTime;

    console.log(
      `✅ Fast 상세 정보 수집 완료: ${results.length}개 (${totalTime}ms, ${Math.round(
        totalTime / products.length
      )}ms/제품)`
    );

    return results;
  }

  private async scrapeProductDetailFast(
    productUrl: string,
    source: string
  ): Promise<ProductDetail | null> {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), this.timeout)
    );

    try {
      const result = await Promise.race([this.tryFastFetch(productUrl, source), timeoutPromise]);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Timeout") {
        console.log(`⏰ Fast-fetch 타임아웃: ${source}`);
      }
      return null;
    }
  }

  private async tryFastFetch(productUrl: string, source: string): Promise<ProductDetail | null> {
    try {
      console.log(`⚡ Fast-fetch 시도: ${productUrl} (${source})`);
      const startTime = Date.now();

      const response = await fetch(productUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.log(`❌ Fast-fetch HTTP ${response.status}: ${source}`);
        return null;
      }

      const html = await response.text();
      const fetchTime = Date.now() - startTime;
      console.log(
        `📄 Fast-fetch HTML 수신: ${html.length.toLocaleString()} bytes (${fetchTime}ms) - ${source}`
      );

      // Route to appropriate fast parser
      switch (source) {
        case "danggeun":
          return this.parseDanggeunFast(html, productUrl);
        case "bunjang":
          return this.parseBunjangFast(html, productUrl);
        case "junggonara":
          return this.parseJunggonaraFast(html, productUrl);
        default:
          return null;
      }
    } catch (error) {
      console.log(`❌ Fast-fetch 실패: ${source}`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  private parseDanggeunFast(html: string, productUrl: string): ProductDetail | null {
    try {
      const $ = cheerio.load(html);

      // Quick validation - ensure we have meaningful content
      const hasContent =
        html.includes("data-testid") || html.includes("article") || html.includes("title");
      if (!hasContent) {
        console.log(`❌ 당근마켓 콘텐츠 없음`);
        return null;
      }

      // Extract title
      let title = "";
      const titleSelectors = [
        'h1[data-testid="title"]',
        'meta[property="og:title"]',
        "title",
        "h1",
      ];

      for (const selector of titleSelectors) {
        const element = $(selector).first();
        const titleText = element.is("meta")
          ? element.attr("content")
          : element.is("title")
          ? element.text().replace(" - 당근마켓", "")
          : element.text().trim();
        if (
          titleText &&
          titleText.length > 3 &&
          titleText.length < 200 &&
          !titleText.includes("당근마켓")
        ) {
          title = titleText;
          break;
        }
      }

      // Extract description
      let description = "";
      const descSelectors = [
        '[data-testid="article-description"]',
        'meta[property="og:description"]',
        'div[class*="article-content"]',
        "section p",
      ];

      for (const selector of descSelectors) {
        const element = $(selector).first();
        const descText = element.is("meta") ? element.attr("content") : element.text().trim();
        if (descText && descText.length > 15 && descText.length < 2000) {
          description = descText;
          break;
        }
      }

      // Extract price
      let priceText = "";
      const pricePatterns = [
        /data-testid="price"[^>]*>([^<]+)/,
        />(\d{1,3}(?:,\d{3})*원)</,
        /(\d+원)/,
      ];

      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          priceText = match[1].trim();
          break;
        }
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract image
      let imageUrl = "";
      const imagePatterns = [
        /meta property="og:image" content="([^"]+)"/,
        /src="([^"]*(?:karroter|daangn|gcp-karroter)[^"]*)"/,
        /data-src="([^"]*(?:karroter|daangn|gcp-karroter)[^"]*)"/,
        /src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
      ];

      for (const pattern of imagePatterns) {
        const match = html.match(pattern);
        if (match) {
          let img = match[1];
          if (img.startsWith("//")) {
            img = "https:" + img;
          } else if (img.startsWith("/")) {
            img = "https://www.daangn.com" + img;
          }
          if (!img.includes("avatar") && !img.includes("icon") && !img.includes("logo")) {
            imageUrl = img;
            break;
          }
        }
      }

      if (title && title.length > 3) {
        console.log(`✅ 당근마켓 Fast 파싱 성공: ${title} - 이미지: ${imageUrl ? "있음" : "없음"}`);
        return {
          id: `danggeun-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "danggeun",
          imageUrl,
          productUrl,
          description: description || "상품 설명을 찾을 수 없습니다.",
          condition: "상태 정보 없음",
          sellerName: "판매자",
          additionalImages: imageUrl ? [imageUrl] : [],
          specifications: { 플랫폼: "당근마켓" },
          tags: ["당근마켓"],
          location: "당근마켓",
          timestamp: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ 당근마켓 Fast 파싱 오류:`, error);
      return null;
    }
  }

  private parseBunjangFast(html: string, productUrl: string): ProductDetail | null {
    try {
      const $ = cheerio.load(html);

      // Extract title - try multiple methods
      let title = "";

      // Method 1: meta tag
      title = $('meta[property="og:title"]').attr("content") || "";

      // Method 2: URL extraction as fallback
      if (!title || title.length < 4) {
        const urlMatch = productUrl.match(/\/products\/\d+\?q=([^&]+)/);
        if (urlMatch) {
          title = decodeURIComponent(urlMatch[1]);
        }
      }

      // Method 3: h1 tags
      if (!title || title.length < 4) {
        title = $("h1").text().trim();
      }

      // Extract price with regex patterns
      let priceText = "";
      const pricePatterns = [
        /class="[^"]*price[^"]*"[^>]*>([^<]*\d[^<]*원[^<]*)</gi,
        />(\d{1,3}(?:,\d{3})*원)</g,
        /(\d+원)/g,
      ];

      for (const pattern of pricePatterns) {
        const matches = html.match(pattern);
        if (matches && matches.length > 0) {
          for (const match of matches) {
            const cleanMatch = match.replace(/[<>]/g, "").trim();
            if (/\d/.test(cleanMatch) && cleanMatch.includes("원")) {
              priceText = cleanMatch;
              break;
            }
          }
          if (priceText) break;
        }
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract description
      let description = "";
      const descSelectors = [
        'meta[property="og:description"]',
        'div[class*="description"]',
        'div[class*="content"]',
      ];

      for (const selector of descSelectors) {
        const element = $(selector).first();
        const descText = element.is("meta") ? element.attr("content") : element.text().trim();
        if (descText && descText.length > 15) {
          description = descText;
          break;
        }
      }

      // Extract image
      let imageUrl = "";
      const imagePatterns = [
        /meta property="og:image" content="([^"]+)"/,
        /src="([^"]*(?:media\.bunjang|bunjang)[^"]*)"/,
        /data-original="([^"]*(?:media\.bunjang|bunjang)[^"]*)"/,
        /src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
      ];

      for (const pattern of imagePatterns) {
        const match = html.match(pattern);
        if (match) {
          let img = match[1];
          if (img.startsWith("//")) {
            img = "https:" + img;
          }
          if (!img.includes("avatar") && !img.includes("icon") && !img.includes("logo")) {
            imageUrl = img;
            break;
          }
        }
      }

      if (title && title.length > 3 && !title.includes("번개장터")) {
        console.log(`✅ 번개장터 Fast 파싱 성공: ${title} - 이미지: ${imageUrl ? "있음" : "없음"}`);
        return {
          id: `bunjang-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "bunjang",
          imageUrl,
          productUrl,
          description: description || "상품 설명을 찾을 수 없습니다.",
          condition: "상태 정보 없음",
          sellerName: "판매자",
          additionalImages: imageUrl ? [imageUrl] : [],
          specifications: { 플랫폼: "번개장터" },
          tags: ["번개장터"],
          location: "번개장터",
          timestamp: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ 번개장터 Fast 파싱 오류:`, error);
      return null;
    }
  }

  private parseJunggonaraFast(html: string, productUrl: string): ProductDetail | null {
    try {
      const $ = cheerio.load(html);

      // Extract title
      let title = "";
      const titleSources = [
        $('meta[property="og:title"]').attr("content"),
        $("title").text().replace(" - 중고나라", ""),
        $("h1").text().trim(),
      ];

      for (const titleText of titleSources) {
        if (titleText && titleText.length > 3 && !titleText.includes("중고나라")) {
          title = titleText;
          break;
        }
      }

      // Extract description
      let description = "";
      const descSources = [
        $('meta[property="og:description"]').attr("content"),
        $('meta[name="description"]').attr("content"),
        $(".product-description").text().trim(),
      ];

      for (const descText of descSources) {
        if (descText && descText.length > 15) {
          description = descText;
          break;
        }
      }

      // Extract price with multiple methods
      let priceText = "";
      const pricePatterns = [/(\d{1,3}(?:,\d{3})*원)/g, /(\d+원)/g];

      for (const pattern of pricePatterns) {
        const matches = html.match(pattern);
        if (matches) {
          // Find the most likely price (usually the first substantial one)
          for (const match of matches) {
            const price = parseInt(match.replace(/[^0-9]/g, ""));
            if (price > 1000) {
              // Reasonable minimum price
              priceText = match;
              break;
            }
          }
          if (priceText) break;
        }
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract image
      let imageUrl = "";
      const imagePatterns = [
        /meta property="og:image" content="([^"]+)"/,
        /src="([^"]*(?:joongna|img2\.joongna)[^"]*)"/,
        /data-src="([^"]*(?:joongna|img2\.joongna)[^"]*)"/,
        /src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
      ];

      for (const pattern of imagePatterns) {
        const match = html.match(pattern);
        if (match) {
          let img = match[1];
          if (img.startsWith("//")) {
            img = "https:" + img;
          } else if (img.startsWith("/")) {
            img = "https://web.joongna.com" + img;
          }
          if (!img.includes("avatar") && !img.includes("icon") && !img.includes("logo")) {
            imageUrl = img;
            break;
          }
        }
      }

      if (title && title.length > 3) {
        console.log(`✅ 중고나라 Fast 파싱 성공: ${title} - 이미지: ${imageUrl ? "있음" : "없음"}`);
        return {
          id: `junggonara-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "junggonara",
          imageUrl,
          productUrl,
          description: description || "상품 설명을 찾을 수 없습니다.",
          condition: "상태 정보 없음",
          sellerName: "판매자",
          additionalImages: imageUrl ? [imageUrl] : [],
          specifications: { 플랫폼: "중고나라" },
          tags: ["중고나라"],
          location: "중고나라",
          timestamp: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ 중고나라 Fast 파싱 오류:`, error);
      return null;
    }
  }

  private isValidDetail(detail: ProductDetail): boolean {
    // More lenient validation - we just need a title that makes sense
    return Boolean(
      detail.title &&
        detail.title.length > 3 &&
        detail.title.length < 300 &&
        !detail.title.includes(detail.source)
    );
  }

  private createFallbackDetail(product: {
    id: string;
    title: string;
    price: number;
    priceText: string;
    source: string;
    imageUrl: string;
    productUrl: string;
  }): ProductDetail {
    return {
      ...product,
      source: product.source as "danggeun" | "bunjang" | "junggonara" | "coupang",
      description: `${product.title} - ${product.source}에서 판매 중인 상품입니다.`,
      condition: "상품 상태 정보 없음",
      sellerName: "판매자",
      additionalImages: [product.imageUrl].filter(Boolean),
      specifications: { 플랫폼: product.source },
      tags: [product.source],
      location: product.source,
    };
  }
}

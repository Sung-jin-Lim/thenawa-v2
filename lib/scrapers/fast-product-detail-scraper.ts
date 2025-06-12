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
  private readonly timeout = 5000; // 8초 → 5초로 단축 (비교용이므로 더 빠르게)
  private readonly maxConcurrent = 6; // 최대 동시 처리 수 제한

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

    // 🔥 배치 처리로 메모리와 네트워크 최적화
    const results: ProductDetail[] = [];
    for (let i = 0; i < products.length; i += this.maxConcurrent) {
      const batch = products.slice(i, i + this.maxConcurrent);

      const batchPromises = batch.map(async (product, index) => {
        try {
          console.log(`📦 [${i + index + 1}/${products.length}] 상세 정보 수집: ${product.title}`);

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

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

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

      // Extract title from multiple sources
      let title = "";
      const titleSources = [
        $('meta[property="og:title"]').attr("content") || "",
        $("title").text() || "",
        $("h1").first().text() || "",
        $('[data-testid="article-title"]').text() || "",
        $(".article-title").text() || "",
      ];

      for (const titleText of titleSources) {
        if (titleText && titleText.length > 3 && !titleText.includes("당근마켓")) {
          title = titleText;
          break;
        }
      }

      // Extract description using multiple methods with better patterns
      let description = "";
      const descSources = [
        () => $('meta[property="og:description"]').attr("content") || "",
        () => $('meta[name="description"]').attr("content") || "",
        () => {
          // Look for actual article content
          const contentSelectors = [
            '[data-testid="article-description"]',
            ".article-description",
            ".article-detail-content",
            ".content-text",
            ".description",
          ];

          for (const selector of contentSelectors) {
            const text = $(selector).text().trim();
            if (text.length > 20) return text;
          }
          return "";
        },
        () => {
          // Look for meaningful content paragraphs
          const contentP = $("p").filter((_, el) => {
            const text = $(el).text().trim();
            return (
              text.length > 20 &&
              !text.includes("당근마켓") &&
              !text.includes("로그인") &&
              !text.includes("회원가입") &&
              !text.includes("앱 다운로드")
            );
          });
          return contentP.first().text().trim();
        },
      ];

      for (const getDesc of descSources) {
        const descText = getDesc();
        if (descText && descText.length > 15) {
          description = descText.substring(0, 300);
          break;
        }
      }

      // Extract price with improved patterns
      let priceText = "";
      const pricePatterns = [
        /(\d{1,3}(?:,\d{3})*원)/g,
        /(\d+원)/g,
        /"price"[:\s]*"?(\d{1,3}(?:,\d{3})*)"?/g,
      ];

      for (const pattern of pricePatterns) {
        const matches = html.match(pattern);
        if (matches) {
          for (const match of matches) {
            const price = parseInt(match.replace(/[^0-9]/g, ""));
            if (price > 1000) {
              priceText = match;
              break;
            }
          }
          if (priceText) break;
        }
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract seller information with better patterns for Danggeun
      let sellerName = "당근 판매자";

      // Try specific selectors first
      const sellerSelectors = [
        '[data-testid="article-author-nickname"]',
        ".article-author-nickname",
        ".seller-nickname",
        ".author-nickname",
        ".user-nickname",
      ];

      for (const selector of sellerSelectors) {
        const name = $(selector).text().trim();
        if (name && name.length > 0 && name !== "당근마켓") {
          sellerName = name.substring(0, 20);
          break;
        }
      }

      // If no selector worked, try text patterns
      if (sellerName === "당근 판매자") {
        const sellerPatterns = [
          /"nickname"[:\s]*"([^"]+)"/i,
          /"authorNickname"[:\s]*"([^"]+)"/i,
          /"author"[:\s]*{[^}]*"nickname"[:\s]*"([^"]+)"/i,
          /작성자[:\s]*([^<>\n,\s]+)/i,
          /판매자[:\s]*([^<>\n,\s]+)/i,
        ];

        for (const pattern of sellerPatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].trim() !== "당근마켓") {
            sellerName = match[1].trim().substring(0, 20);
            break;
          }
        }
      }

      // Extract condition information with better patterns
      let condition = "상태 정보 없음";
      const conditionKeywords = [
        "새상품",
        "거의새것",
        "상급",
        "중급",
        "하급",
        "A급",
        "B급",
        "C급",
        "미개봉",
        "리퍼",
        "깨끗",
        "양호",
        "완전새상품",
        "사용감없음",
        "사용감적음",
        "사용감많음",
      ];

      // First try explicit condition patterns
      const conditionPatterns = [
        /상태[:\s]*([^<>\n\.,]+)/i,
        /condition[:\s]*([^<>\n\.,]+)/i,
        /품질[:\s]*([^<>\n\.,]+)/i,
        /(새상품|거의새것|상급|중급|하급|A급|B급|C급|미개봉|리퍼|깨끗|양호|완전새상품|사용감없음|사용감적음|사용감많음)/i,
      ];

      for (const pattern of conditionPatterns) {
        const match = (title + " " + description).match(pattern);
        if (match && match[1]) {
          condition = match[1].trim();
          break;
        }
      }

      // If no explicit condition found, search more thoroughly
      if (condition === "상태 정보 없음") {
        const allText = `${title} ${description}`.toLowerCase();
        for (const keyword of conditionKeywords) {
          if (allText.includes(keyword.toLowerCase())) {
            condition = keyword;
            break;
          }
        }
      }

      // Extract location with better patterns for Danggeun
      let location = "당근마켓";

      // Try specific selectors first
      const locationSelectors = [
        '[data-testid="article-region"]',
        ".article-region",
        ".region-name",
        ".location-text",
      ];

      for (const selector of locationSelectors) {
        const loc = $(selector).text().trim();
        if (loc && loc.length > 0) {
          location = loc.substring(0, 20);
          break;
        }
      }

      // If no selector worked, try URL and text patterns
      if (location === "당근마켓") {
        // Extract from URL first (more reliable)
        const urlLocationMatch = productUrl.match(/in=([^&]+)/);
        if (urlLocationMatch) {
          const urlLoc = decodeURIComponent(urlLocationMatch[1]).replace(/-\d+$/, "");
          if (urlLoc && urlLoc !== "당근마켓") {
            location = urlLoc;
          }
        } else {
          // Try text patterns
          const locationPatterns = [
            /"region"[:\s]*{[^}]*"name"[:\s]*"([^"]+)"/i,
            /"regionName"[:\s]*"([^"]+)"/i,
            /지역[:\s]*([^<>\n\.,]+)/i,
            /위치[:\s]*([^<>\n\.,]+)/i,
            /([가-힣]+구\s*[가-힣]+동)/,
            /([가-힣]+동)/,
          ];

          for (const pattern of locationPatterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].trim()) {
              location = match[1].trim().substring(0, 20);
              break;
            }
          }
        }
      }

      // Extract image with improved patterns
      let imageUrl = "";
      const imagePatterns = [
        /meta property="og:image" content="([^"]+)"/,
        /src="([^"]*(?:karroter|daangn|cloudfront)[^"]*)"/,
        /data-src="([^"]*(?:karroter|daangn|cloudfront)[^"]*)"/,
        /src="([^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
        /"image"[:\s]*"([^"]+)"/,
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

      if (title && title.length > 3) {
        console.log(
          `✅ 당근마켓 Fast 파싱 성공: ${title} - 판매자: ${sellerName}, 위치: ${location}, 상태: ${condition}`
        );
        return {
          id: `danggeun-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "danggeun",
          imageUrl,
          productUrl,
          description: description || `${title} - 당근마켓에서 판매 중인 상품입니다.`,
          condition,
          sellerName,
          additionalImages: imageUrl ? [imageUrl] : [],
          specifications: { 플랫폼: "당근마켓" },
          tags: ["당근마켓"],
          location,
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

      // Improved description extraction with specific class
      let description = "";

      // Try multiple methods to find the actual product description
      const descriptionMethods = [
        // Method 1: Specific Bunjang description class
        () => {
          const specificDesc = $(".ProductInfostyle__DescriptionContent-sc-ql55c8-3 p")
            .text()
            .trim();
          return specificDesc;
        },
        // Method 2: Alternative Bunjang description patterns
        () => {
          const descDiv = $('div[class*="DescriptionContent"] p, div[class*="description"] p')
            .text()
            .trim();
          return descDiv;
        },
        // Method 3: Look for actual content divs
        () => {
          const contentDiv = $(
            'div[class*="content"], div[class*="description"], div[class*="detail"]'
          ).not('[class*="header"], [class*="title"], [class*="nav"]');
          return contentDiv.text().trim();
        },
        // Method 4: Look for paragraphs with actual content (not title)
        () => {
          const paragraphs = $("p").filter((_, el) => {
            const text = $(el).text().trim();
            return (
              text.length > 20 &&
              !text.includes("번개장터") &&
              !text.includes("로그인") &&
              text !== title
            ); // Exclude title duplicates
          });
          return paragraphs.first().text().trim();
        },
        // Method 5: Meta description
        () => $('meta[property="og:description"]').attr("content") || "",
        // Method 6: Any div with substantial text content (different from title)
        () => {
          let bestDesc = "";
          $("div").each((_, el) => {
            const text = $(el).text().trim();
            if (
              text.length > 30 &&
              text.length < 500 &&
              !text.includes("번개장터") &&
              !text.includes("로그인") &&
              !text.includes("카테고리") &&
              text !== title &&
              text.length > bestDesc.length
            ) {
              bestDesc = text;
            }
          });
          return bestDesc;
        },
      ];

      for (const method of descriptionMethods) {
        const desc = method();
        if (desc && desc.length > 15 && desc !== title) {
          description = desc.substring(0, 300); // Limit length
          break;
        }
      }

      // Extract seller information
      let sellerName = "판매자";
      const sellerPatterns = [
        /판매자[:\s]*([^<>\n]+)/i,
        /seller[:\s]*([^<>\n]+)/i,
        /업체명[:\s]*([^<>\n]+)/i,
      ];

      for (const pattern of sellerPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          sellerName = match[1].trim().substring(0, 20);
          break;
        }
      }

      // Extract condition information
      let condition = "상태 정보 없음";
      const conditionKeywords = [
        "새상품",
        "거의새것",
        "상급",
        "중급",
        "하급",
        "A급",
        "B급",
        "C급",
        "미개봉",
        "리퍼",
      ];
      const conditionPatterns = [
        /상태[:\s]*([^<>\n]+)/i,
        /condition[:\s]*([^<>\n]+)/i,
        /(새상품|거의새것|상급|중급|하급|A급|B급|C급|미개봉|리퍼)/i,
      ];

      for (const pattern of conditionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          condition = match[1].trim();
          break;
        }
      }

      // Also check in title and description for condition keywords
      const allText = `${title} ${description}`.toLowerCase();
      for (const keyword of conditionKeywords) {
        if (allText.includes(keyword.toLowerCase())) {
          condition = keyword;
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
        console.log(
          `✅ 번개장터 Fast 파싱 성공: ${title} - 판매자: ${sellerName}, 상태: ${condition}`
        );
        return {
          id: `bunjang-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "bunjang",
          imageUrl,
          productUrl,
          description: description || `${title} - 번개장터에서 판매 중인 상품입니다.`,
          condition,
          sellerName,
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
        $('[data-testid="product-title"]').text().trim(),
        $(".product-title").text().trim(),
      ];

      for (const titleText of titleSources) {
        if (titleText && titleText.length > 3 && !titleText.includes("중고나라")) {
          title = titleText;
          break;
        }
      }

      // Extract description with better patterns
      let description = "";
      const descSources = [
        () => $('meta[property="og:description"]').attr("content") || "",
        () => $('meta[name="description"]').attr("content") || "",
        () => $(".product-description").text().trim(),
        () => $('[data-testid="product-description"]').text().trim(),
        () => {
          // Look for content paragraphs
          const contentP = $("p").filter((_, el) => {
            const text = $(el).text().trim();
            return (
              text.length > 20 &&
              !text.includes("중고나라") &&
              !text.includes("로그인") &&
              !text.includes("회원가입")
            );
          });
          return contentP.first().text().trim();
        },
      ];

      for (const getDesc of descSources) {
        const descText = getDesc();
        if (descText && descText.length > 15) {
          description = descText.substring(0, 300);
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

      // Extract seller information
      let sellerName = "중고나라 판매자";
      const sellerSelectors = [
        '[data-testid="seller-nickname"]',
        ".seller-nickname",
        ".seller-name",
        ".author-name",
        ".user-nickname",
      ];

      for (const selector of sellerSelectors) {
        const name = $(selector).text().trim();
        if (name && name.length > 0 && name !== "중고나라") {
          sellerName = name.substring(0, 20);
          break;
        }
      }

      // Try text patterns if selectors didn't work
      if (sellerName === "중고나라 판매자") {
        const sellerPatterns = [
          /"seller"[:\s]*{[^}]*"nickname"[:\s]*"([^"]+)"/i,
          /"sellerNickname"[:\s]*"([^"]+)"/i,
          /판매자[:\s]*([^<>\n,\s]+)/i,
          /작성자[:\s]*([^<>\n,\s]+)/i,
        ];

        for (const pattern of sellerPatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].trim() !== "중고나라") {
            sellerName = match[1].trim().substring(0, 20);
            break;
          }
        }
      }

      // Extract condition information
      let condition = "상태 정보 없음";
      const conditionKeywords = [
        "새상품",
        "거의새것",
        "상급",
        "중급",
        "하급",
        "A급",
        "B급",
        "C급",
        "미개봉",
        "리퍼",
        "깨끗",
        "양호",
        "완전새상품",
        "사용감없음",
        "사용감적음",
        "사용감많음",
      ];

      // First try explicit condition patterns
      const conditionPatterns = [
        /상태[:\s]*([^<>\n\.,]+)/i,
        /condition[:\s]*([^<>\n\.,]+)/i,
        /품질[:\s]*([^<>\n\.,]+)/i,
        /(새상품|거의새것|상급|중급|하급|A급|B급|C급|미개봉|리퍼|깨끗|양호|완전새상품|사용감없음|사용감적음|사용감많음)/i,
      ];

      for (const pattern of conditionPatterns) {
        const match = (title + " " + description).match(pattern);
        if (match && match[1]) {
          condition = match[1].trim();
          break;
        }
      }

      // If no explicit condition found, search more thoroughly
      if (condition === "상태 정보 없음") {
        const allText = `${title} ${description}`.toLowerCase();
        for (const keyword of conditionKeywords) {
          if (allText.includes(keyword.toLowerCase())) {
            condition = keyword;
            break;
          }
        }
      }

      // Extract location
      let location = "중고나라";
      const locationSelectors = [
        '[data-testid="seller-location"]',
        ".seller-location",
        ".location-text",
        ".region-name",
      ];

      for (const selector of locationSelectors) {
        const loc = $(selector).text().trim();
        if (loc && loc.length > 0) {
          location = loc.substring(0, 20);
          break;
        }
      }

      // Try text patterns if selectors didn't work
      if (location === "중고나라") {
        const locationPatterns = [
          /"location"[:\s]*"([^"]+)"/i,
          /"region"[:\s]*"([^"]+)"/i,
          /지역[:\s]*([^<>\n\.,]+)/i,
          /위치[:\s]*([^<>\n\.,]+)/i,
          /([가-힣]+구\s*[가-힣]+동)/,
          /([가-힣]+동)/,
        ];

        for (const pattern of locationPatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].trim()) {
            location = match[1].trim().substring(0, 20);
            break;
          }
        }
      }

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
        console.log(
          `✅ 중고나라 Fast 파싱 성공: ${title} - 판매자: ${sellerName}, 위치: ${location}, 상태: ${condition}`
        );
        return {
          id: `junggonara-fast-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText: priceText || "가격 정보 없음",
          source: "junggonara",
          imageUrl,
          productUrl,
          description: description || "상품 설명을 찾을 수 없습니다.",
          condition,
          sellerName,
          additionalImages: imageUrl ? [imageUrl] : [],
          specifications: { 플랫폼: "중고나라" },
          tags: ["중고나라"],
          location,
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

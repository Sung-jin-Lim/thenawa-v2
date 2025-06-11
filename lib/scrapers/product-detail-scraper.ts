import { Product } from "@/types/product";
import * as cheerio from "cheerio";
import { browserManager } from "../browser-manager";

export interface ProductDetail extends Product {
  description: string;
  condition: string;
  sellerName: string;
  additionalImages: string[];
  specifications: Record<string, string>;
  tags: string[];
  location?: string;
}

export class ProductDetailScraper {
  async scrapeProductDetail(productUrl: string, source: string): Promise<ProductDetail | null> {
    try {
      console.log(`📦 상세 정보 수집 시도: ${productUrl} (${source})`);

      // Check if the platform is supported for detailed scraping
      switch (source) {
        case "danggeun":
          return await this.scrapeDanggeunDetail(productUrl);
        case "bunjang":
          return await this.scrapeBunjangDetail(productUrl);
        case "junggonara":
          return await this.scrapeJunggonaraDetail(productUrl);
        default:
          console.log(`⚠️ 지원하지 않는 플랫폼: ${source}`);
          return null;
      }
    } catch (error) {
      console.error(`❌ 상세 정보 수집 실패: ${productUrl}`, error);
      return null;
    }
  }

  private async scrapeDanggeunDetail(productUrl: string): Promise<ProductDetail | null> {
    let page = null;

    try {
      console.log(`🥕 당근마켓 상세 정보 수집: ${productUrl}`);

      // Create page from shared browser
      page = await browserManager.createPage();

      // Set user agent for better compatibility
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/120.0.0.0 Safari/537.36"
      );

      // Navigate to product page with longer timeout for dynamic content
      await page.goto(productUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for dynamic content to load
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Try to wait for main content
      try {
        await page.waitForSelector('h1, [data-testid], [class*="title"]', { timeout: 10000 });
      } catch {
        console.log("⚠️ 당근마켓: 기본 선택자 대기 실패, 계속 진행");
      }

      // Get HTML and parse with Cheerio
      const html = await page.content();
      const $ = cheerio.load(html);

      console.log(`📄 당근마켓 페이지 구조 분석:`);
      console.log(`- h1 태그: ${$("h1").length}개`);
      console.log(`- data-testid 속성: ${$("[data-testid]").length}개`);
      console.log(`- 가격 관련 요소: ${$('*:contains("원")').length}개`);

      // Extract title with improved selectors based on modern Danggeun structure
      let title = "";
      const titleSelectors = [
        'h1[data-testid="title"]',
        'h1[class*="title"]',
        '[data-testid="article-title"]',
        '[data-testid="product-title"]',
        "h1",
        '[class*="ArticleTitle"]',
        '[class*="title"]:not(:contains("당근마켓"))',
        'meta[property="og:title"]',
      ];

      for (const selector of titleSelectors) {
        const element = $(selector).first();
        const titleText = element.is("meta") ? element.attr("content") : element.text().trim();
        if (
          titleText &&
          titleText.length > 3 &&
          titleText.length < 200 &&
          !titleText.includes("당근마켓") &&
          !titleText.includes("Daangn")
        ) {
          title = titleText;
          console.log(`✅ 당근마켓 제목 발견 (${selector}): ${title}`);
          break;
        }
      }

      // Extract description with more specific selectors for Danggeun
      let description = "";
      const descriptionSelectors = [
        '[data-testid="article-description"]',
        '[data-testid="description"]',
        '[data-testid="content"]',
        'div[class*="ArticleContent"]',
        'div[class*="article-content"]',
        'div[class*="product-content"]',
        'div[class*="Description"]:not([class*="Header"]):not([class*="Nav"])',
        'section[class*="description"] p',
        "article section p",
        'main p:not(:contains("당근마켓")):not(:contains("로그인"))',
        'div[role="main"] p',
        '[class*="detail-content"] p',
        '[class*="article-body"] p',
      ];

      for (const selector of descriptionSelectors) {
        const elements = $(selector);
        elements.each((_, el) => {
          const text = $(el).text().trim();
          // More strict filtering for Danggeun to avoid navigation content
          if (
            text &&
            text.length > 15 && // Require longer text
            text.length < 2000 &&
            !text.includes("당근마켓") &&
            !text.includes("로그인") &&
            !text.includes("회원가입") &&
            !text.includes("고객센터") &&
            !text.includes("중고거래") &&
            !text.includes("부동산") &&
            !text.includes("중고차") &&
            !text.includes("알바") &&
            !text.includes("동네업체") &&
            !text.includes("동네생활") &&
            !text.includes("모임") &&
            !text.includes("검색") &&
            !text.includes("앱 다운로드") &&
            !text.match(/^[가-힣]{2,10}동$/) && // Exclude location-only text like "마장동"
            text.split(" ").length > 3 // Require at least 4 words
          ) {
            description = text;
            console.log(`✅ 당근마켓 설명 발견 (${selector}): ${text.substring(0, 100)}...`);
            return false; // Break from each loop
          }
        });
        if (description) break;
      }

      // Extract price with modern Danggeun selectors
      let priceText = "";
      const priceSelectors = [
        '[data-testid="price"]',
        '[data-testid="article-price"]',
        '[class*="Price"]',
        '[class*="price"]',
        'span:contains("원")',
        'div:contains("원")',
      ];

      for (const selector of priceSelectors) {
        const elements = $(selector);
        for (let i = 0; i < elements.length; i++) {
          const element = elements.eq(i);
          const text = element.text().trim();
          if (
            text.includes("원") &&
            /\d/.test(text) &&
            !text.includes("배송") &&
            !text.includes("수수료") &&
            text.length < 50
          ) {
            const priceMatch = text.match(/[\d,]+원/);
            if (priceMatch) {
              priceText = priceMatch[0];
              console.log(`✅ 당근마켓 가격 발견 (${selector}): ${priceText}`);
              break;
            }
          }
        }
        if (priceText) break;
      }

      if (!priceText) {
        priceText = "가격 정보 없음";
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract seller information
      let sellerName = "";
      const sellerSelectors = [
        '[data-testid="seller-name"]',
        '[data-testid="nickname"]',
        '[class*="seller"]',
        '[class*="nickname"]',
        '[class*="user"]',
      ];

      for (const selector of sellerSelectors) {
        const text = $(selector).first().text().trim();
        if (text && text.length > 0 && text.length < 50) {
          sellerName = text;
          console.log(`✅ 당근마켓 판매자 발견: ${sellerName}`);
          break;
        }
      }

      if (!sellerName) {
        sellerName = "판매자";
      }

      // Extract condition/status
      let condition = "";
      const conditionKeywords = ["새상품", "중고", "거의새것", "사용감있음"];
      $("*").each((_, el) => {
        const text = $(el).text().trim();
        for (const keyword of conditionKeywords) {
          if (text.includes(keyword)) {
            condition = keyword;
            return false;
          }
        }
      });

      if (!condition) {
        condition = "상태 정보 없음";
      }

      // Extract location
      let location = "";
      const locationSelectors = [
        '[data-testid="location"]',
        '[data-testid="region"]',
        '[class*="location"]',
        '[class*="region"]',
        '[class*="address"]',
      ];

      for (const selector of locationSelectors) {
        const text = $(selector).first().text().trim();
        if (text && text.length > 0 && text.length < 100) {
          location = text;
          console.log(`✅ 당근마켓 위치 발견: ${location}`);
          break;
        }
      }

      if (!location) {
        location = "당근마켓";
      }

      // Extract images more comprehensively
      const additionalImages: string[] = [];
      $("img").each((_, img) => {
        const src =
          $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-original") || "";

        if (
          src &&
          (src.includes("karroter.net") ||
            src.includes("daangn") ||
            src.includes("d1unjqcospf4l.cloudfront.net") ||
            src.includes("images"))
        ) {
          let fullUrl = src;
          if (src.startsWith("//")) {
            fullUrl = `https:${src}`;
          } else if (src.startsWith("/") && !src.startsWith("//")) {
            fullUrl = `https://www.daangn.com${src}`;
          }

          if (
            !additionalImages.includes(fullUrl) &&
            !fullUrl.includes("logo") &&
            !fullUrl.includes("icon") &&
            !fullUrl.includes("avatar")
          ) {
            additionalImages.push(fullUrl);
          }
        }
      });

      // Extract specifications
      const specifications: Record<string, string> = {
        플랫폼: "당근마켓",
        상품상태: condition,
        위치: location,
        판매자: sellerName,
      };

      const tags = ["당근마켓"];
      if (condition && condition !== "상태 정보 없음") tags.push(condition);
      if (location && location !== "당근마켓" && location !== "위치 정보 없음") tags.push(location);

      // Improved validation - require either meaningful title or description
      const hasValidTitle = title && title.length > 3 && !title.includes("당근마켓");
      const hasValidDescription = description && description.length > 10;
      const hasValidPrice = price > 0;

      console.log(`🔍 당근마켓 데이터 검증:`);
      console.log(`- 제목: ${hasValidTitle ? "✅" : "❌"} "${title}"`);
      console.log(
        `- 설명: ${hasValidDescription ? "✅" : "❌"} "${description.substring(0, 50)}..."`
      );
      console.log(`- 가격: ${hasValidPrice ? "✅" : "❌"} ${priceText}`);

      if (hasValidTitle || hasValidDescription) {
        const productDetail: ProductDetail = {
          id: `danggeun-detail-${Date.now()}`,
          title: title || "당근마켓 상품",
          price,
          priceText,
          source: "danggeun",
          imageUrl: additionalImages[0] || "",
          productUrl,
          description: description || "상품 설명을 찾을 수 없습니다.",
          condition,
          sellerName,
          additionalImages: additionalImages.slice(0, 10),
          specifications,
          tags,
          location,
          timestamp: new Date().toISOString(),
        };

        console.log(`✅ 당근마켓 상세 정보 수집 완료: ${productDetail.title}`);
        return productDetail;
      } else {
        console.log(`⚠️ 당근마켓 상세 정보 불충분 - 제목과 설명 모두 없음`);
        return null;
      }
    } catch (error) {
      console.error(`❌ 당근마켓 상세 수집 오류:`, error);
      return null;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error("❌ Error closing Danggeun detail page:", e);
        }
      }
    }
  }

  private async scrapeBunjangDetail(productUrl: string): Promise<ProductDetail | null> {
    let page = null;

    try {
      console.log(`⚡ 번개장터 상세 정보 수집: ${productUrl}`);

      // Create page from shared browser
      page = await browserManager.createPage();

      // Set user agent and viewport (from working example)
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/112.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate to product page with longer timeout and networkidle0
      await page.goto(productUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for key content indicators with multiple fallbacks
      const contentSelectors = [
        'div[class*="ProductInfo"]',
        'div[class*="product-info"]',
        'div[class*="detail"]',
        'div[class*="description"]',
        'p:contains("상태")',
        'p:contains("기스")',
        'p:contains("배송")',
      ];

      let contentFound = false;
      for (const selector of contentSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ 번개장터 콘텐츠 발견: ${selector}`);
          contentFound = true;
          break;
        } catch {
          console.log(`⚠️ 선택자 없음: ${selector}`);
          continue;
        }
      }

      if (!contentFound) {
        console.log("⚠️ 주요 콘텐츠 선택자를 찾지 못함, 추가 대기 시도");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Get HTML and parse with Cheerio
      const html = await page.content();
      const $ = cheerio.load(html);

      // Log page structure for debugging
      console.log(`📄 번개장터 HTML 구조:`);
      $('div[class*="product"], div[class*="detail"], div[class*="info"]').each((_, el) => {
        console.log(`- ${$(el).attr("class")}: ${$(el).text().substring(0, 50)}...`);
      });

      // Extract product details for Bunjang with improved selectors
      let title = "";
      const titleSelectors = [
        'h1:not(:contains("번개장터"))',
        'div[class*="ProductInfo"] h1',
        'div[class*="product-title"]',
        'div[class*="title"]:not(:contains("번개장터"))',
        'meta[property="og:title"]',
      ];

      for (const selector of titleSelectors) {
        const element = $(selector).first();
        const titleText = element.is("meta") ? element.attr("content") : element.text().trim();
        if (
          titleText &&
          titleText.length > 5 &&
          titleText.length < 200 &&
          !titleText.includes("번개장터")
        ) {
          title = titleText;
          console.log(`✅ 번개장터 제목 발견 (${selector}): ${title}`);
          break;
        }
      }

      // If no title found through selectors, try extracting from URL
      if (!title) {
        const urlMatch = productUrl.match(/\/products\/\d+\?q=([^&]+)/);
        if (urlMatch) {
          title = decodeURIComponent(urlMatch[1]);
          console.log(`✅ 번개장터 제목 발견 (URL): ${title}`);
        }
      }

      // Based on real HTML inspection, target description with multiple approaches
      let description = "";
      const descriptionSelectors = [
        'div[class*="ProductInfostyle__DescriptionContent"]',
        'div[class*="product-description"]',
        'div[class*="description"]',
        'div[class*="content"]',
        'div[class*="detail"] p',
      ];

      for (const selector of descriptionSelectors) {
        const text = $(selector).text().trim();
        if (text && text.length > 20 && !text.includes("번개장터") && !text.includes("로그인")) {
          description = text;
          console.log(`✅ 번개장터 설명 발견 (${selector}): ${text.substring(0, 100)}...`);
          break;
        }
      }

      // If no description found through selectors, try finding paragraphs
      if (!description) {
        $("p").each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 20 && !text.includes("번개장터") && !text.includes("로그인")) {
            description = text;
            console.log(`✅ 번개장터 설명 발견 (paragraph): ${text.substring(0, 100)}...`);
            return false;
          }
        });
      }

      // Extract price with improved validation
      let priceText = "가격 정보 없음";
      const priceSelectors = [
        'div[class*="price"]',
        'span[class*="price"]',
        'div[class*="ProductInfo"] span:contains("원")',
        'div:contains("원")',
        'meta[property="product:price:amount"]',
      ];

      for (const selector of priceSelectors) {
        const elements = $(selector).toArray();
        for (const elem of elements) {
          const text = $(elem).text().trim();
          if (
            text.includes("원") &&
            /\d/.test(text) &&
            !text.includes("배송") &&
            text.length < 30
          ) {
            const priceMatch = text.match(/[\d,]+원/);
            if (priceMatch) {
              priceText = priceMatch[0];
              console.log(`✅ 번개장터 가격 발견: ${priceText}`);
              break;
            }
          }
        }
        if (priceText !== "가격 정보 없음") break;
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      // Extract seller info
      const sellerName =
        $('[class*="seller"]').text().trim() ||
        $('[class*="nickname"]').text().trim() ||
        $('[class*="user"]').text().trim() ||
        "판매자";

      // Extract condition with improved selectors
      const condition =
        $('p:contains("상태"):contains("상")').text().trim() ||
        $('[class*="condition"]').text().trim() ||
        $('[class*="status"]').text().trim() ||
        "상태 정보 없음";

      const location = "번개장터";

      // Extract images with improved validation
      const additionalImages: string[] = [];
      $("img").each((_, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src") || "";

        if (
          src &&
          (src.includes("media") || src.includes("images")) &&
          !src.includes("logo") &&
          !src.includes("icon") &&
          !src.includes("avatar")
        ) {
          const fullUrl = src.startsWith("//") ? `https:${src}` : src;
          if (!additionalImages.includes(fullUrl)) {
            additionalImages.push(fullUrl);
          }
        }
      });

      const specifications: Record<string, string> = {
        플랫폼: "번개장터",
        상품상태: condition,
        판매자: sellerName,
      };

      const tags = ["번개장터"];
      if (condition && condition !== "상태 정보 없음") tags.push(condition);

      // Validate we have minimum required data with relaxed criteria
      if (
        title &&
        title.length > 3 &&
        !title.includes("번개장터") &&
        (description || price > 0) // Allow products with either description or valid price
      ) {
        const productDetail: ProductDetail = {
          id: `bunjang-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText,
          source: "bunjang",
          imageUrl: additionalImages[0] || "",
          productUrl,
          description: description.substring(0, 1000) || "상품 설명을 찾을 수 없습니다.",
          condition,
          sellerName,
          additionalImages: additionalImages.slice(0, 10),
          specifications,
          tags,
          location,
          timestamp: new Date().toISOString(),
        };

        console.log(`✅ 번개장터 상세 정보 수집 완료: ${title}`);
        return productDetail;
      } else {
        console.log(`⚠️ 번개장터 상세 정보 불충분:`, {
          titleLength: title?.length || 0,
          titleHasBunjang: title?.includes("번개장터") || false,
          descriptionLength: description?.length || 0,
          price,
          imagesCount: additionalImages.length,
        });
        return null;
      }
    } catch (error) {
      console.error(`❌ 번개장터 상세 수집 오류:`, error);
      return null;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error("❌ Error closing Bunjang detail page:", e);
        }
      }
    }
  }

  private async scrapeJunggonaraDetail(productUrl: string): Promise<ProductDetail | null> {
    try {
      console.log(`💼 중고나라 상세 정보 수집: ${productUrl}`);

      // Use fetch for Junggonara instead of Puppeteer (faster)
      const response = await fetch(productUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        console.log(`❌ 중고나라 HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract product details for Junggonara
      const title =
        $("h1").text().trim() ||
        $('[data-testid="product-title"]').text().trim() ||
        $('[class*="title"]').first().text().trim() ||
        $('meta[property="og:title"]').attr("content") ||
        "";

      // Based on real HTML inspection, target paragraph elements containing description
      const allParagraphs = $("p").toArray();
      let description = "";

      // Find the paragraph with meaningful product description (filter out common non-product text)
      const blacklistKeywords = [
        "중고나라",
        "로그인",
        "회원가입",
        "고객센터",
        "문의",
        "운영시간",
        "점심시간",
        "주말",
        "공휴일",
        "이메일",
        "전화",
        "상담",
        "FAQ",
        "도움이 필요하면",
        "고객지원",
        "서비스",
        "약관",
        "1670-2910",
        "번개톡",
        "바로구매",
        "안전결제",
        "찜",
        "신고하기",
        "개인정보",
        "처리방침",
        "이용약관",
        "회원가입",
        "로그인",
        "마이페이지",
      ];

      for (const p of allParagraphs) {
        const text = $(p).text().trim();
        const hasBlacklistWord = blacklistKeywords.some((keyword) => text.includes(keyword));

        if (text.length > 20 && text.length < 1000 && !hasBlacklistWord) {
          description = text;
          console.log(`✅ 중고나라 설명 발견 (paragraph): ${text.substring(0, 100)}...`);
          break;
        }
      }

      // Fallback to specific selectors if paragraph approach fails
      if (!description) {
        const fallbackSelectors = [
          ".flex-1.py-5.text-base.font-normal.break-words.break-all.whitespace-pre-line.text-jnGray-900",
          '[class*="flex-1"][class*="py-5"][class*="text-base"][class*="break-words"]',
          "article p",
          '[data-testid="product-description"]',
          '[class*="description"]',
          ".product-description",
          '[class*="content"]',
        ];

        for (const selector of fallbackSelectors) {
          const text = $(selector).text().trim();
          if (text && text.length > 20) {
            console.log(`✅ 중고나라 설명 발견 (${selector}): ${text.substring(0, 100)}...`);
            description = text;
            break;
          }
        }
      }

      if (!description) {
        console.log(`❌ 중고나라 설명을 찾을 수 없음`);
        description = "상품 설명을 찾을 수 없습니다.";
      }

      // Improved price extraction for Junggonara
      let priceText = "가격 정보 없음";

      // Try multiple price selectors and validate the result
      const priceSelectors = [
        '[data-testid="product-price"]',
        '[class*="price"]',
        'span:contains("원")',
        'div:contains("원")',
        'p:contains("원")',
      ];

      for (const selector of priceSelectors) {
        const candidates = $(selector).toArray();
        for (const elem of candidates) {
          const text = $(elem).text().trim();
          // Check if text contains numbers and 원, but exclude location-like strings and safety transaction text
          if (
            text.includes("원") &&
            /\d/.test(text) &&
            !text.includes("동") &&
            !text.includes("구") &&
            !text.includes("시") &&
            !text.includes("안전거래") &&
            !text.includes("배송") &&
            text.length < 30
          ) {
            // Extract just the price part, removing any extra text
            const priceMatch = text.match(/[\d,]+원/);
            if (priceMatch) {
              priceText = priceMatch[0];
              console.log(`✅ 중고나라 가격 발견 (${selector}): ${priceText}`);
              break;
            }
          }
        }
        if (priceText !== "가격 정보 없음") break;
      }

      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || 0;

      const sellerName =
        $('[data-testid="seller-name"]').text().trim() ||
        $('[class*="seller"]').text().trim() ||
        $('[class*="user"]').text().trim() ||
        "판매자";

      const condition =
        $('[data-testid="product-condition"]').text().trim() ||
        $('[class*="condition"]').text().trim() ||
        $('[class*="status"]').text().trim() ||
        "상태 정보 없음";

      const location =
        $('[data-testid="product-location"]').text().trim() ||
        $('[class*="location"]').text().trim() ||
        $('[class*="region"]').text().trim() ||
        "중고나라";

      // Extract images based on real HTML inspection
      const additionalImages: string[] = [];
      $("img").each((_, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src") || "";
        const alt = $(img).attr("alt") || "";

        // Based on inspection: product images have alt text like "title--0", "title--1", etc.
        const isProductImage =
          alt.includes("--") ||
          src.includes("joongna") ||
          src.includes("media") ||
          src.includes("upload");

        if (src && isProductImage && !src.includes("logo") && !src.includes("icon")) {
          const fullUrl = src.startsWith("//")
            ? `https:${src}`
            : src.startsWith("/")
            ? `https://web.joongna.com${src}`
            : src;
          additionalImages.push(fullUrl);
        }
      });

      const specifications: Record<string, string> = {
        플랫폼: "중고나라",
        상품상태: condition,
        위치: location,
        판매자: sellerName,
      };

      const tags = ["중고나라"];
      if (condition && condition !== "상태 정보 없음") tags.push(condition);
      if (location && location !== "중고나라" && location !== "위치 정보 없음") tags.push(location);

      // Only return if we got meaningful data
      if (title && title !== "상품명 정보 없음" && !title.includes("중고나라")) {
        const productDetail: ProductDetail = {
          id: `junggonara-detail-${Date.now()}`,
          title: title.substring(0, 200),
          price,
          priceText,
          source: "junggonara",
          imageUrl: additionalImages[0] || "",
          productUrl,
          description: description.substring(0, 1000),
          condition,
          sellerName,
          additionalImages: additionalImages.slice(0, 10),
          specifications,
          tags,
          location,
          timestamp: new Date().toISOString(),
        };

        console.log(`✅ 중고나라 상세 정보 수집 완료: ${title}`);
        return productDetail;
      } else {
        console.log(`⚠️ 중고나라 상세 정보 불충분, 폴백 사용`);
        return null;
      }
    } catch (error) {
      console.error(`❌ 중고나라 상세 수집 오류:`, error);
      return null;
    }
  }
}

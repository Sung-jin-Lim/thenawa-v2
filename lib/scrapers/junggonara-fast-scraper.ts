import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";
import * as cheerio from "cheerio";

export class JunggonaraFastScraper extends BaseScraper {
  sourceName = "junggonara";
  baseUrl = "https://web.joongna.com";

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    console.log(`🚀 중고나라 Fast-Fetch 전용 스크래퍼 시작: ${query}`);
    return this.tryFastFetch(query, limit);
  }

  private async tryFastFetch(query: string, limit: number): Promise<Product[]> {
    const startTime = Date.now();

    try {
      const searchUrl = `https://web.joongna.com/search/${encodeURIComponent(query)}`;

      console.log(`📄 중고나라 HTML 수신 시작: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: AbortSignal.timeout(8000), // 8초 타임아웃
      });

      if (!response.ok) {
        console.log(`❌ 중고나라 HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();
      const fetchTime = Date.now() - startTime;

      console.log(`📄 중고나라 HTML 수신: ${html.length.toLocaleString()} bytes (${fetchTime}ms)`);

      // 차단 감지 (더 정확하게)
      if (
        html.includes("Access Denied") ||
        html.includes("Forbidden") ||
        html.includes("captcha") ||
        html.length < 5000
      ) {
        console.log("⚠️ 중고나라 차단 감지, 빈 결과 반환");
        return [];
      }

      // 정상적인 한국어 페이지인지 확인
      if (!html.includes("중고나라") && !html.includes("검색") && !html.includes("상품")) {
        console.log("⚠️ 중고나라 페이지 구조 이상, 빈 결과 반환");
        return [];
      }

      const products = this.extractProductsFromHTML(html, limit);

      if (products.length > 0) {
        console.log(`✅ 중고나라 Fast-Fetch 성공: ${products.length}개 (${fetchTime}ms)`);
        return products;
      } else {
        console.log(`⚠️ 중고나라 Fast-Fetch: 상품을 찾지 못함 (${fetchTime}ms)`);
        return [];
      }
    } catch (error) {
      console.error("❌ 중고나라 Fast-Fetch 오류:", error);
      return [];
    }
  }

  private extractProductsFromHTML(html: string, limit: number): Product[] {
    const products: Product[] = [];
    const $ = cheerio.load(html);

    console.log(`📄 중고나라 HTML 길이: ${html.length}`);

    // 🎯 상품 링크 찾기 - 중고나라 특화 선택자 (실제 HTML 구조 기반)
    const selectors = [
      'a[href^="/product/"]', // /product/로 시작하는 링크
      "a.relative.group", // 실제 상품 카드 클래스
      ".relative.group a", // 상품 카드 내부 링크
      'a[href*="/product/"]', // 일반적인 상품 링크
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let productElements: cheerio.Cheerio<any> | null = null;
    let usedSelector = "";

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        productElements = elements;
        usedSelector = selector;
        console.log(`✅ 중고나라 선택자 성공: ${selector} (${elements.length}개 요소)`);
        break;
      } else {
        console.log(`❌ 중고나라 선택자 실패: ${selector} (0개 요소)`);
      }
    }

    if (!productElements || productElements.length === 0) {
      console.log("❌ 중고나라: 상품 요소를 찾을 수 없음");

      // 디버깅: HTML 구조 확인
      const bodyText = $("body").text().substring(0, 500);
      console.log(`🔍 페이지 텍스트 미리보기: ${bodyText}`);

      return [];
    }

    console.log(
      `🎯 중고나라 상품 요소 발견: ${productElements.length}개 (선택자: ${usedSelector})`
    );

    // 상품 정보 추출
    productElements.slice(0, limit).each((index, element) => {
      try {
        const $element = $(element);

        // URL 추출
        let productUrl = $element.attr("href") || "";
        if (productUrl && !productUrl.startsWith("http")) {
          productUrl = productUrl.startsWith("/")
            ? `${this.baseUrl}${productUrl}`
            : `${this.baseUrl}/${productUrl}`;
        }

        if (
          !productUrl ||
          !productUrl.includes("/product/") ||
          productUrl.includes("/product/form")
        ) {
          console.log(`⚠️ [${index}] 잘못된 URL 스킵: ${productUrl}`);
          return; // 상품 URL이 유효하지 않거나 판매폼이면 스킵
        }

        // 제목 추출 - 중고나라 실제 구조 기반
        let title =
          $element.find("h2").text().trim() || // 실제 제목이 h2에 있음
          $element.find("h3").text().trim() ||
          $element.find(".line-clamp-2").text().trim() || // 실제 클래스
          $element.attr("title") ||
          $element.text().split("\n")[0]?.trim() || // 첫 번째 텍스트 라인
          "";

        // 부모/형제 요소에서 제목 찾기
        if (!title) {
          const parent = $element.parent();
          title =
            parent.find("h2").text().trim() || parent.find(".line-clamp-2").text().trim() || "";
        }

        // 판매하기, 등록하기 등 비상품 제목 필터링
        const nonProductTitles = ["판매하기", "등록하기", "상품등록", "글쓰기", "sell", "post"];
        const isNonProduct = nonProductTitles.some((keyword) =>
          title.toLowerCase().includes(keyword.toLowerCase())
        );

        if (!title || title.length < 2 || isNonProduct) {
          console.log(`⚠️ [${index}] 제목 없음 또는 비상품 스킵: ${title}`);
          return; // 제목이 없거나 너무 짧거나 비상품이면 스킵
        }

        // 가격 추출 - 중고나라 실제 구조 기반
        let priceText =
          $element.find(".font-semibold").text().trim() || // 실제 가격 클래스
          $element.find(".text-heading").text().trim() ||
          $element.find('div:contains("원")').first().text().trim() ||
          $element.find('span:contains("원")').first().text().trim() ||
          "";

        // 부모에서 가격 찾기
        if (!priceText) {
          const parent = $element.parent();
          priceText =
            parent.find(".font-semibold").text().trim() ||
            parent.find('div:contains("원")').first().text().trim() ||
            "";
        }

        if (!priceText || !priceText.includes("원")) {
          priceText = "가격 문의";
        }

        const cleanPrice = priceText.replace(/[^\d]/g, "");
        const price = cleanPrice ? parseInt(cleanPrice) : 0;

        // 이미지 URL 추출
        let imageUrl = "";
        const imgElement = $element.find("img").first();
        if (imgElement.length) {
          imageUrl =
            imgElement.attr("src") ||
            imgElement.attr("data-src") ||
            imgElement.attr("data-lazy-src") ||
            imgElement.attr("data-original") ||
            "";
        }

        // 부모에서 이미지 찾기
        if (!imageUrl) {
          const parent = $element.parent();
          const parentImg = parent.find("img").first();
          if (parentImg.length) {
            imageUrl =
              parentImg.attr("src") ||
              parentImg.attr("data-src") ||
              parentImg.attr("data-lazy-src") ||
              "";
          }
        }

        // 이미지 URL 정제
        if (imageUrl) {
          if (imageUrl.startsWith("//")) {
            imageUrl = `https:${imageUrl}`;
          } else if (!imageUrl.startsWith("http") && imageUrl.startsWith("/")) {
            imageUrl = `${this.baseUrl}${imageUrl}`;
          }
        }

        // 위치 정보 추출
        const location =
          $element.find('[data-testid="product-location"]').text().trim() ||
          $element.find(".product-location").text().trim() ||
          $element.find('[class*="region"]').text().trim() ||
          $element.find('[class*="location"]').text().trim() ||
          "중고나라";

        const product: Product = {
          id: `junggonara-fast-${products.length}-${Date.now()}`,
          title: title.substring(0, 100).trim(),
          price,
          priceText: priceText.trim(),
          source: "junggonara" as const,
          productUrl,
          imageUrl,
          location: location.substring(0, 50).trim(),
          timestamp: new Date().toISOString(),
          description: `중고나라에서 판매 중인 ${title}`,
        };

        products.push(product);

        console.log(
          `✅ 중고나라 상품 추가: ${title} - ${priceText} (이미지: ${imageUrl ? "있음" : "없음"})`
        );
      } catch (error) {
        console.error(`❌ 중고나라 상품 처리 오류 [${index}]:`, error);
      }
    });

    console.log(`🎯 중고나라 최종 결과: ${products.length}개 상품`);
    return products;
  }
}

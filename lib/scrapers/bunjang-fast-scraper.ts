import { BaseScraper } from "./base-scraper";
import type { Product } from "@/types/product";

export class BunjangFastScraper extends BaseScraper {
  sourceName = "bunjang";
  baseUrl = "https://www.bunjang.co.kr";

  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    // 🚀 Use Bunjang's public API instead of Puppeteer (much faster!)
    return this.tryBunjangAPI(query, limit);
  }

  private async tryBunjangAPI(query: string, limit: number): Promise<Product[]> {
    const startTime = Date.now();
    const products: Product[] = [];

    try {
      // 🚀 Bunjang API endpoint - much faster than Puppeteer
      const apiUrl = `https://api.bunjang.co.kr/api/1/find_v2.json?q=${encodeURIComponent(
        query
      )}&n=${limit}`;
      console.log(`🚀 번개장터 API 호출: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: AbortSignal.timeout(5000), // 5초 타임아웃 (API는 빠름)
      });

      if (!response.ok) {
        console.log(`❌ 번개장터 API HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      const fetchTime = Date.now() - startTime;
      console.log(`📊 번개장터 API 응답: ${fetchTime}ms`);

      if (data.result !== "success" || !data.list || !Array.isArray(data.list)) {
        console.log("❌ 번개장터 API 응답 구조 오류");
        return [];
      }

      console.log(`🎯 번개장터 API 상품 발견: ${data.list.length}개`);

      // Process API response
      data.list
        .slice(0, limit)
        .forEach(
          (item: {
            name?: string;
            price?: string;
            pid?: string;
            product_image?: string;
            location?: string;
          }) => {
            try {
              const title = item.name?.trim() || "";
              const price = parseInt(item.price || "0") || 0;
              const priceText = price ? price.toLocaleString() + "원" : "가격 문의";

              // Generate product URL
              const productUrl = `${this.baseUrl}/products/${item.pid}?q=${encodeURIComponent(
                query
              )}&ref=검색결과`;

              // Process image URL
              let imageUrl = item.product_image || "";
              if (imageUrl) {
                // Replace {res} with actual resolution
                imageUrl = imageUrl.replace("{res}", "266");
                if (imageUrl.startsWith("//")) {
                  imageUrl = "https:" + imageUrl;
                }
              }

              // Validate product
              if (
                title &&
                title.length > 2 &&
                item.pid &&
                !title.includes("판매하기") &&
                !title.includes("로그인") &&
                !title.includes("회원가입")
              ) {
                const product: Product = {
                  id: `bunjang-api-${item.pid}-${Date.now()}`,
                  title: title.substring(0, 100).trim(),
                  price,
                  priceText,
                  source: "bunjang" as const,
                  productUrl,
                  imageUrl: imageUrl || "",
                  location: item.location || "번개장터",
                  timestamp: new Date().toISOString(),
                  description: `번개장터에서 판매 중인 ${title}`,
                };

                products.push(product);
                console.log(
                  `✅ 번개장터 API 상품 추가: ${title} - ${priceText} (이미지: ${
                    imageUrl ? "있음" : "없음"
                  })`
                );
              }
            } catch (error) {
              console.error(`❌ 번개장터 API 상품 파싱 오류:`, error);
            }
          }
        );

      console.log(`🎯 번개장터 API 최종 결과: ${products.length}개 상품`);
      console.log(`⚡ 번개장터 API 완료: ${Date.now() - startTime}ms (초고속!)`);

      return products.slice(0, limit);
    } catch (error) {
      console.error("❌ 번개장터 API 오류:", error);
      return [];
    }
  }
}

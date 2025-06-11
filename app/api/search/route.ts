import { NextRequest, NextResponse } from "next/server";
import { DanggeunScraper } from "@/lib/scrapers/danggeun-scraper";
import { BunjangScraper } from "@/lib/scrapers/bunjang-scraper";
import { JunggonaraScraper } from "@/lib/scrapers/junggonara-scraper";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import { SearchRequest, SearchResponse, Product } from "@/types/product";

export const dynamic = "force-dynamic";
export const maxDuration = 40; // 🔥 40초로 증가 (Vercel 환경 대응)

// 🔧 타입 정의
type ScraperConstructor = new () => BaseScraper;

// 🔥 환경별 타임아웃 설정 (Vercel 제약 고려하여 더 관대하게)
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
const SCRAPER_CONFIG = {
  INDIVIDUAL_TIMEOUT: isVercel ? 18000 : 8000, // Vercel: 18초, Local: 8초
  DANGGEUN_TIMEOUT: isVercel ? 25000 : 15000, // Danggeun은 더 길게 (Vercel: 25초, Local: 15초)
  TOTAL_TIMEOUT: isVercel ? 35000 : 25000, // 전체 타임아웃 (Vercel: 35초, Local: 25초)
  MIN_RESULTS: 15, // 🔥 15개로 증가 (조기 종료 방지)
  PARALLEL_LIMIT: 2, // 동시 실행 개수 제한
} as const;

console.log(
  `🔧 환경 설정: ${isVercel ? "Vercel" : "Local"}, 타임아웃: ${SCRAPER_CONFIG.TOTAL_TIMEOUT}ms`
);

// 🔧 Vercel 환경 디버깅
if (isVercel) {
  console.log(`🔍 Vercel 환경 세부정보: {
    VERCEL: ${process.env.VERCEL},
    VERCEL_ENV: ${process.env.VERCEL_ENV},
    개별타임아웃: ${SCRAPER_CONFIG.INDIVIDUAL_TIMEOUT}ms,
    당근타임아웃: ${SCRAPER_CONFIG.DANGGEUN_TIMEOUT}ms
  }`);
}

// Configuration is now defined above

// 🔥 핵심 최적화 2: 타임아웃과 조기 종료가 있는 스크래퍼 실행
async function runScraperWithTimeout(
  ScraperClass: ScraperConstructor,
  query: string,
  limit: number,
  timeoutMs: number = SCRAPER_CONFIG.INDIVIDUAL_TIMEOUT,
  sourceName: string // 🔧 명시적 소스명 전달 (빌드 최적화 대응)
): Promise<Product[]> {
  let isResolved = false; // 🔧 중복 해결 방지

  return new Promise(async (resolve) => {
    // 타임아웃 설정
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.log(`⏰ ${sourceName} 타임아웃 (${timeoutMs}ms) - 빈 배열 반환`);
        resolve([]);
      }
    }, timeoutMs);

    try {
      const scraper = new ScraperClass();
      console.log(`🚀 ${sourceName} 시작 (제한시간: ${timeoutMs}ms)`);

      const results = await scraper.searchProducts(query, limit);

      if (!isResolved) {
        isResolved = true;
        console.log(`✅ ${sourceName} 완료: ${results.length}개 (${Date.now()}ms)`);
        clearTimeout(timeout);
        resolve(results);
      }
    } catch (error) {
      if (!isResolved) {
        isResolved = true;
        console.error(`❌ ${sourceName} 스크래핑 오류:`, error);
        clearTimeout(timeout);
        resolve([]);
      }
    }
  });
}

// 🔥 핵심 최적화 3: 제한된 병렬 처리 (Vercel 리소스 고려)
async function runScrapersOptimized(query: string, sources: string[]): Promise<Product[]> {
  const allProducts: Product[] = [];
  const limitPerSource = 7; // 🔥 각 플랫폼당 고정 7개씩

  // 🔥 Strategy 1: 빠른 플랫폼 우선 (번개장터가 보통 가장 빠름)
  const prioritizedSources = sources.sort((a, b) => {
    const priority = { bunjang: 1, junggonara: 2, danggeun: 3 };
    return (
      (priority[a as keyof typeof priority] || 99) - (priority[b as keyof typeof priority] || 99)
    );
  });

  // 🔥 Strategy 2: 모든 소스를 한 번에 병렬 처리 (중복 실행 방지)
  const batchPromises = prioritizedSources.map((source) => {
    switch (source) {
      case "danggeun":
        return runScraperWithTimeout(
          DanggeunScraper,
          query,
          limitPerSource,
          SCRAPER_CONFIG.DANGGEUN_TIMEOUT,
          "당근마켓"
        ); // 당근마켓 전용 타임아웃
      case "bunjang":
        return runScraperWithTimeout(
          BunjangScraper,
          query,
          limitPerSource,
          SCRAPER_CONFIG.INDIVIDUAL_TIMEOUT,
          "번개장터"
        ); // 번개장터
      case "junggonara":
        return runScraperWithTimeout(
          JunggonaraScraper,
          query,
          limitPerSource,
          SCRAPER_CONFIG.INDIVIDUAL_TIMEOUT,
          "중고나라"
        ); // 중고나라
      default:
        return Promise.resolve([]);
    }
  });

  const batchResults = await Promise.all(batchPromises);

  // 🔥 개선된 결과 수집 및 로깅
  batchResults.forEach((results, index) => {
    const source = prioritizedSources[index];
    const sourceName =
      source === "danggeun"
        ? "당근마켓"
        : source === "bunjang"
        ? "번개장터"
        : source === "junggonara"
        ? "중고나라"
        : source;
    console.log(`📦 ${sourceName} 결과 수집: ${results.length}개 상품`);
    allProducts.push(...results);
  });

  console.log(`📊 전체 배치 완료: ${allProducts.length}개 결과 (${prioritizedSources.join(", ")})`);

  // Strategy 3: All platforms execute once - no early termination

  return allProducts;
}

// 🔥 핵심 최적화 4: 전체 타임아웃과 조기 응답
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 🚨 전체 프로세스 타임아웃 설정
  const globalTimeout = setTimeout(() => {
    console.log(`🚨 글로벌 타임아웃! (${SCRAPER_CONFIG.TOTAL_TIMEOUT}ms)`);
  }, SCRAPER_CONFIG.TOTAL_TIMEOUT);

  try {
    const body: SearchRequest = await request.json();
    const { query, sources = ["danggeun", "bunjang", "junggonara"], limit = 10 } = body; // 🔥 당근마켓 다시 포함

    if (!query?.trim()) {
      clearTimeout(globalTimeout);
      return NextResponse.json({ error: "검색어를 입력해주세요." }, { status: 400 });
    }

    console.log(
      `🔍 최적화된 검색 시작: "${query}", 플랫폼: ${sources.join(", ")}, 제한: ${limit}개`
    );

    // 🔥 최적화된 스크래핑 실행
    const products = await runScrapersOptimized(query, sources);

    clearTimeout(globalTimeout);

    // 🔥 스크래핑 결과 상세 로깅
    const sourceBreakdown = products.reduce((acc, product) => {
      acc[product.source] = (acc[product.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`🔍 스크래핑 결과 상세:`, {
      총상품수: products.length,
      소스별분포: sourceBreakdown,
      요청된소스: sources,
    });

    // 🔥 빠른 중복 제거 (간단한 URL 기반)
    const uniqueProducts = products
      .filter(
        (product, index, self) =>
          index === self.findIndex((p) => p.productUrl === product.productUrl)
      )
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);

    // 🔥 최종 결과 검증 로깅
    const finalSourceBreakdown = uniqueProducts.reduce((acc, product) => {
      acc[product.source] = (acc[product.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const executionTime = Date.now() - startTime;
    console.log(`⚡ 최적화된 검색 완료: ${uniqueProducts.length}개 상품, ${executionTime}ms 소요`);
    console.log(`📊 최종 응답 데이터:`, {
      총상품수: uniqueProducts.length,
      소스별분포: finalSourceBreakdown,
      중복제거전: products.length,
    });

    const response: SearchResponse = {
      query,
      sources,
      count: uniqueProducts.length,
      products: uniqueProducts,
      executionTime,
      // 🔥 성능 메트릭 추가
      performance: {
        totalTime: executionTime,
        avgTimePerProduct:
          uniqueProducts.length > 0 ? Math.round(executionTime / uniqueProducts.length) : 0,
        isOptimized: true,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    clearTimeout(globalTimeout);
    const executionTime = Date.now() - startTime;

    console.error(`❌ 최적화된 검색 오류 (${executionTime}ms):`, error);

    // 🔥 부분 성공이라도 반환 (조기 응답 전략)
    return NextResponse.json(
      {
        error: "일부 검색에서 오류가 발생했습니다.",
        query: "",
        sources: [],
        count: 0,
        products: [],
        executionTime,
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 206 } // Partial Content
    );
  }
}

// 🔥 추가 최적화: 헬스체크 엔드포인트
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: SCRAPER_CONFIG,
  });
}

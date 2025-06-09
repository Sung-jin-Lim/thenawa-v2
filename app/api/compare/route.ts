import { NextRequest, NextResponse } from "next/server";
import { ProductDetailScraper, ProductDetail } from "@/lib/scrapers/product-detail-scraper";

interface ComparisonRequest {
  products: Array<{
    id: string;
    title: string;
    price: number;
    priceText: string;
    source: string;
    imageUrl: string;
    productUrl: string;
  }>;
}

interface ProductAnalysis {
  id: string;
  valueRating: number;
  pros: string[];
  cons: string[];
  conditionScore: number;
  priceScore: number;
}

interface ComparisonAnalysis {
  comparison: Record<string, string>;
  products: ProductAnalysis[];
  bestValue: {
    productId: string;
    reason: string;
  };
  recommendations: string;
  summary: string;
}

export async function POST(request: NextRequest) {
  try {
    const { products }: ComparisonRequest = await request.json();

    if (!products || !Array.isArray(products) || products.length < 2) {
      return NextResponse.json({ error: "비교할 제품을 최소 2개 선택해주세요." }, { status: 400 });
    }

    console.log(`🔄 제품 비교 시작: ${products.length}개 제품`);

    const scraper = new ProductDetailScraper();
    const detailedProducts: ProductDetail[] = [];

    // Scrape detailed information for each product
    for (const product of products) {
      try {
        console.log(`📦 상품 상세 정보 수집: ${product.title}`);
        const detail = await scraper.scrapeProductDetail(product.productUrl, product.source);

        if (
          detail &&
          detail.title &&
          detail.title !== "제품명 정보 없음" &&
          !detail.title.includes(product.source)
        ) {
          // Valid detail scraped - use it
          detailedProducts.push(detail);
        } else {
          console.log(
            `⚠️ 상세 정보 수집 실패 또는 부정확한 데이터, 원본 데이터 사용: ${product.title}`
          );
          // Fallback to original product info with enhanced data
          detailedProducts.push({
            ...product,
            description: product.title + " - " + product.source + "에서 판매 중인 상품입니다.",
            condition: "상품 상태 정보 없음",
            sellerName: "판매자",
            additionalImages: [product.imageUrl].filter(Boolean),
            specifications: {},
            tags: [],
          });
        }
      } catch (error) {
        console.error(`❌ 상품 상세 정보 수집 실패: ${product.title}`, error);
        // Use original product info as fallback
        detailedProducts.push({
          ...product,
          description: product.title + " - " + product.source + "에서 판매 중인 상품입니다.",
          condition: "상품 상태 정보 없음",
          sellerName: "판매자",
          additionalImages: [product.imageUrl].filter(Boolean),
          specifications: {},
          tags: [],
        });
      }
    }

    console.log(`✅ 상품 상세 정보 수집 완료: ${detailedProducts.length}개`);

    // Generate AI comparison analysis
    const analysis = await generateComparison(detailedProducts);

    return NextResponse.json({
      success: true,
      analysis,
      detailedProducts,
    });
  } catch (error) {
    console.error("❌ 비교 API 오류:", error);
    return NextResponse.json(
      { error: "비교 분석 중 오류가 발생했습니다: " + (error as Error).message },
      { status: 500 }
    );
  }
}

async function generateComparison(products: ProductDetail[]): Promise<ComparisonAnalysis> {
  try {
    console.log("🤖 AI 비교 분석 시작...");

    const prompt = `당신은 한국의 중고거래 전문가입니다. 다음 제품들을 종합적으로 비교 분석해주세요.

제품 정보:
${products
  .map(
    (product, index) => `
제품 ${index + 1}:
- 제목: ${product.title}
- 가격: ${product.priceText}
- 플랫폼: ${product.source}
- 판매자: ${product.sellerName}
- 상품 상태: ${product.condition}
- 상세 설명: ${product.description}
- 사양: ${JSON.stringify(product.specifications)}
- 위치: ${product.location || "정보 없음"}
`
  )
  .join("\n")}

다음 기준으로 비교 분석해주세요:

1. 가격 대비 가치
2. 상품 상태 및 품질
3. 판매자 신뢰도
4. 거래 편의성
5. 사양 및 기능

각 제품의 장단점을 분석하고, 어떤 제품이 더 나은 선택인지 추천해주세요.

응답은 반드시 다음 JSON 형식으로 해주세요:
{
  "comparison": {
    "가격": "가격 비교 분석",
    "상태": "상품 상태 비교",
    "판매자": "판매자 비교",
    "사양": "사양 비교",
    "위치": "거래 위치 비교"
  },
  "products": [
    {
      "id": "제품ID",
      "valueRating": 0-10점수,
      "pros": ["장점1", "장점2"],
      "cons": ["단점1", "단점2"],
      "conditionScore": 0-10점수,
      "priceScore": 0-10점수
    }
  ],
  "bestValue": {
    "productId": "추천제품ID",
    "reason": "추천 이유"
  },
  "recommendations": "구매 가이드 및 추천",
  "summary": "종합 분석 요약"
}

모든 내용은 한국어로 작성해주세요.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국 중고거래 전문가입니다. 정확하고 유용한 제품 비교 분석을 제공합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API 오류: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    console.log("🤖 AI 원본 응답:", content);

    if (!content) {
      throw new Error("AI 응답을 받을 수 없습니다.");
    }

    // Parse AI response
    let analysis: ComparisonAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log("🔍 JSON 추출 성공:", jsonMatch[0].substring(0, 200) + "...");
        analysis = JSON.parse(jsonMatch[0]);
        console.log("✅ 파싱된 분석 데이터:", analysis);
      } else {
        throw new Error("JSON 형식을 찾을 수 없습니다.");
      }
    } catch (parseError) {
      console.error("❌ AI 응답 파싱 오류:", parseError);
      console.error("❌ 파싱 실패한 내용:", content);

      // Fallback analysis
      analysis = {
        comparison: {
          가격:
            products.length > 1
              ? `첫 번째 제품(${products[0].priceText})이 두 번째 제품(${
                  products[1].priceText
                })보다 ${products[0].price < products[1].price ? "저렴합니다" : "비쌉니다"}`
              : "가격 비교 불가",
          상태: "상품 상태 정보를 확인해주세요",
          판매자: "각 제품의 판매자를 확인해주세요",
          사양: "상세 사양을 비교해보세요",
          위치: "거래 위치를 고려해주세요",
        },
        products: products.map((product) => ({
          id: product.id,
          valueRating: 7,
          pros: ["중고 제품", "합리적 가격"],
          cons: ["상세 분석 필요"],
          conditionScore: 7,
          priceScore: 7,
        })),
        bestValue: {
          productId: products[0].id,
          reason: "추가 정보 확인 후 결정하세요",
        },
        recommendations:
          "각 제품의 상세 정보를 추가로 확인하신 후 구매 결정을 내리시길 권장합니다.",
        summary: "제품 비교를 위해 더 많은 정보가 필요합니다.",
      };
    }

    console.log("✅ AI 비교 분석 완료");
    return analysis;
  } catch (error) {
    console.error("❌ AI 비교 분석 오류:", error);

    // Return fallback analysis
    return {
      comparison: {
        가격: "AI 분석을 사용할 수 없습니다",
        상태: "수동으로 확인해주세요",
        판매자: "판매자 정보를 확인해주세요",
        사양: "사양을 직접 비교해주세요",
        위치: "거래 위치를 확인해주세요",
      },
      products: products.map((product) => ({
        id: product.id,
        valueRating: 5,
        pros: ["중고 제품"],
        cons: ["분석 불가"],
        conditionScore: 5,
        priceScore: 5,
      })),
      bestValue: {
        productId: products[0].id,
        reason: "수동 확인 필요",
      },
      recommendations: "AI 분석을 사용할 수 없어 수동으로 비교하시길 권장합니다.",
      summary: "AI 분석 서비스를 사용할 수 없습니다.",
    };
  }
}

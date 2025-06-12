import { NextRequest, NextResponse } from "next/server";
import {
  FastProductDetailScraper,
  ProductDetail,
} from "@/lib/scrapers/fast-product-detail-scraper";

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

    const scraper = new FastProductDetailScraper();

    // Use fast parallel processing instead of sequential
    const detailedProducts = await scraper.scrapeProductsDetails(products);

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
제품 ${index + 1} (ID: ${product.id}):
- 제목: ${product.title}
- 가격: ${product.priceText} (${product.price}원)
- 플랫폼: ${product.source}
- 판매자: ${product.sellerName}
- 상품 상태: ${product.condition}
- 상세 설명: ${product.description}
- 사양: ${JSON.stringify(product.specifications)}
- 위치: ${product.location || "정보 없음"}
`
  )
  .join("\n")}

**분석 요구사항:**
1. 각 카테고리별로 구체적이고 상세한 비교 분석을 제공하세요
2. 실제 제품 정보를 바탕으로 정확한 분석을 하세요
3. 가격, 상태, 사양을 구체적으로 비교하세요
4. 실용적이고 도움이 되는 조언을 제공하세요
5. **중요**: 각 제품의 장점(pros)과 단점(cons)은 실제 제품명, 가격, 설명을 분석하여 구체적으로 생성하세요

**중요: 응답은 반드시 아래 JSON 형식으로만 해주세요. 각 필드는 구체적이고 실제적인 내용으로 채워주세요.**

{
  "comparison": {
    "가격": "실제 가격을 비교하고 가성비를 분석해주세요",
    "상태": "각 제품의 상태를 구체적으로 비교해주세요", 
    "판매자": "판매자와 플랫폼의 신뢰도를 분석해주세요",
    "사양": "제품 사양과 기능을 상세히 비교해주세요",
    "위치": "거래 위치와 편의성을 비교해주세요"
  },
  "products": [
    {
      "id": "실제_제품_ID",
      "valueRating": 1-10,
      "pros": ["제품명/가격/설명을 기반으로 한 구체적 장점들"],
      "cons": ["제품명/가격/설명을 기반으로 한 구체적 단점들"], 
      "conditionScore": 1-10,
      "priceScore": 1-10
    }
  ],
  "bestValue": {
    "productId": "가장_추천하는_제품_ID",
    "reason": "구체적이고 상세한 추천 이유"
  },
  "recommendations": "실용적인 구매 가이드와 주의사항",
  "summary": "전체 비교 분석의 핵심 요약"
}

**필수 지침:**
- 실제 제품 정보를 기반으로 분석하세요
- 플레이스홀더나 예시 텍스트를 사용하지 마세요  
- 각 제품의 실제 ID를 사용하세요
- 구체적이고 실용적인 조언을 제공하세요
- **pros/cons는 제품명, 가격, 설명 내용을 구체적으로 분석하여 생성하세요**
- 예: "아이폰 13" → pros: ["최신 iOS 지원", "A15 바이오닉 칩 성능"], cons: ["배터리 교체 이력 불분명", "높은 가격대"]
- JSON 형식만 응답하고 다른 텍스트는 포함하지 마세요`;

    // Debug API key length for security
    const apiKeyLength = process.env.OPENROUTER_API_KEY?.length || 0;
    console.log(`🔑 API 키 길이: ${apiKeyLength}`);

    const requestBody = {
      model: "meta-llama/llama-3.1-8b-instruct:free",
      messages: [
        {
          role: "system",
          content:
            "당신은 한국 중고거래 전문가입니다. 정확하고 유용한 제품 비교 분석을 제공합니다. 응답은 반드시 유효한 JSON 형식으로만 해주세요. 다른 형식의 텍스트는 절대 포함하지 마세요.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };

    console.log(`🚀 OpenRouter 요청:`, {
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      systemMessage: requestBody.messages[0].content.substring(0, 100) + "...",
      promptLength: prompt.length,
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://thenawa.vercel.app",
        "X-Title": "TheNawa Product Comparison",
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📡 OpenRouter 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter API 오류 (${response.status}):`, errorText);
      throw new Error(`OpenRouter API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("📊 OpenRouter 전체 응답:", {
      model: data.model,
      usage: data.usage,
      choicesCount: data.choices?.length,
      firstChoiceFinishReason: data.choices?.[0]?.finish_reason,
    });

    const content = data.choices[0]?.message?.content;
    console.log("🤖 AI 원본 응답 (처음 500자):", content?.substring(0, 500) + "...");

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
        products: products.map((product) => {
          // Generate basic pros/cons based on product data
          const pros = [];
          const cons = [];

          // Price-based analysis
          if (product.price < 200000) pros.push("합리적인 가격대");
          if (product.price > 500000) cons.push("높은 가격");

          // Platform-based analysis
          if (product.source === "danggeun") pros.push("당근마켓 플랫폼 안전성");
          if (product.source === "junggonara") pros.push("중고나라 다양한 선택지");
          if (product.source === "bunjang") pros.push("번개장터 빠른 거래");

          // Product name analysis
          if (product.title.includes("아이폰") || product.title.includes("iPhone")) {
            pros.push("애플 제품 안정성");
            if (
              product.title.includes("13") ||
              product.title.includes("14") ||
              product.title.includes("15")
            ) {
              pros.push("최신 기종");
            }
          }

          if (product.title.includes("갤럭시") || product.title.includes("Galaxy")) {
            pros.push("안드로이드 호환성");
            pros.push("다양한 기능");
          }

          // Condition-based analysis
          if (product.condition.includes("새상품") || product.condition.includes("거의새것")) {
            pros.push("우수한 제품 상태");
          } else if (product.condition.includes("사용감")) {
            cons.push("사용감 있는 상태");
          }

          // Default fallbacks
          if (pros.length === 0) pros.push("실제 제품 정보 확인 필요");
          if (cons.length === 0) cons.push("상세 분석 필요");

          return {
            id: product.id,
            valueRating: 7,
            pros,
            cons,
            conditionScore: 7,
            priceScore: 7,
          };
        }),
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

import { NextRequest, NextResponse } from "next/server";
import { Product } from "@/types/product";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // AI 추천은 10초 제한

interface AIRecommendRequest {
  query: string;
  products: Product[];
}

interface AIRecommendResponse {
  success: boolean;
  recommendedIds: string[];
  reasoning?: string;
  executionTime: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 🔑 API Key 체크 및 디버깅
    const apiKey = process.env.OPENROUTER_API_KEY;
    const hasApiKey = !!apiKey;
    console.log(`🔑 API Key loaded: ${hasApiKey ? "YES" : "NO"}`);
    console.log(`🔑 API Key starts with: ${apiKey?.substring(0, 12)}...`);
    console.log(`🔑 API Key length: ${apiKey?.length}`);
    console.log(`🔑 FULL API Key (for debugging): ${apiKey}`);
    console.log(
      `🔑 Full environment keys:`,
      Object.keys(process.env).filter((k) => k.includes("OPENROUTER"))
    );

    if (!hasApiKey) {
      return NextResponse.json(
        {
          success: false,
          recommendedIds: [],
          error: "OpenRouter API 키가 설정되지 않았습니다.",
          executionTime: Date.now() - startTime,
        } as AIRecommendResponse,
        { status: 500 }
      );
    }

    const body: AIRecommendRequest = await request.json();
    const { query, products } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        {
          success: false,
          recommendedIds: [],
          error: "Please enter a search query.",
          executionTime: Date.now() - startTime,
        } as AIRecommendResponse,
        { status: 400 }
      );
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          recommendedIds: [],
          error: "No products to analyze.",
          executionTime: Date.now() - startTime,
        } as AIRecommendResponse,
        { status: 400 }
      );
    }

    console.log(`🤖 AI 추천 시작: "${query}", ${products.length}개 상품 분석 (Qwen3 8B)`);

    // 🔥 상품 요약 (성능 최적화)
    const maxProducts = Math.min(products.length, 20);
    const selectedProducts = products.slice(0, maxProducts);

    // 🔥 최적화된 프롬프트 (단일 최고 상품 추천)
    const prompt = `당신은 한국 중고거래 전문가입니다. 다음 검색어에 대한 상품들을 분석하고 최고의 상품을 추천해주세요.

검색어: "${query}"

상품 목록:
${selectedProducts
  .map(
    (product, index) =>
      `${index}. ${product.title} - ${product.priceText} (출처: ${product.source})`
  )
  .join("\n")}

다음 기준으로 가장 좋은 상품 1개를 선택해주세요:
1. 검색어와의 관련성
2. 가격 대비 가치
3. 상품 상태 및 신뢰도
4. 전체적인 만족도 예상

응답은 반드시 다음 JSON 형식으로 해주세요:
{
  "recommendedIndices": [선택한 상품의 인덱스 번호],
  "reasoning": "한국어로 추천 이유를 설명해주세요"
}

중요: reasoning은 반드시 한국어로 작성해주세요.`;

    // 🔥 OpenRouter API 호출
    console.log(`🚀 Making OpenRouter request to: https://openrouter.ai/api/v1/chat/completions`);
    console.log(`🚀 Model: meta-llama/llama-3.1-8b-instruct:free`);
    console.log(`🔑 Auth header will be: Bearer ${apiKey?.substring(0, 20)}...`);

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://thenawa.vercel.app",
      "X-Title": "TheNawa Product Search",
      "Content-Type": "application/json",
    };

    console.log(`🔑 Headers being sent:`, Object.keys(headers));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    console.log(`📥 OpenRouter response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ OpenRouter error response: ${errorText}`);
      throw new Error(`OpenRouter API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || "";

    console.log(`🤖 Qwen3 8B 응답: ${responseText}`);

    // 🔥 JSON 파싱 (안전한 파싱)
    let recommendationData;
    try {
      // JSON 부분만 추출 (```json ``` 마크다운 제거)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      recommendationData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError);
      return NextResponse.json(
        {
          success: false,
          recommendedIds: [],
          error: "Cannot parse AI response.",
          executionTime: Date.now() - startTime,
        } as AIRecommendResponse,
        { status: 500 }
      );
    }

    // 🔥 추천 인덱스를 상품 ID로 변환
    const recommendedIds: string[] = [];
    const validIndices = recommendationData.recommendedIndices || [];

    for (const index of validIndices) {
      if (typeof index === "number" && index >= 0 && index < products.length) {
        recommendedIds.push(products[index].id);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(
      `🤖 AI 최고 추천 완료: ${recommendedIds.length}개 상품 선별, ${executionTime}ms 소요`
    );

    const response2: AIRecommendResponse = {
      success: true,
      recommendedIds,
      reasoning:
        recommendationData.reasoning || "AI-selected best product based on comprehensive analysis.",
      executionTime,
    };

    return NextResponse.json(response2);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ AI 추천 오류 (${executionTime}ms):`, error);

    return NextResponse.json(
      {
        success: false,
        recommendedIds: [],
        error: error instanceof Error ? error.message : "Error occurred during AI recommendation.",
        executionTime,
      } as AIRecommendResponse,
      { status: 500 }
    );
  }
}

// 헬스체크 엔드포인트
export async function GET() {
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;

  return NextResponse.json({
    status: "ok",
    hasApiKey,
    model: "meta-llama/llama-3.1-8b-instruct:free",
    timestamp: new Date().toISOString(),
  });
}

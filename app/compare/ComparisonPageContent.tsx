"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Star,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  MapPin,
  User,
  Package,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import DynamicLoader from "@/components/ui/dynamic-loader";
import { getSourceName, getSourceColor } from "@/lib/utils";

// Updated type definitions
interface Product {
  id: string;
  title: string;
  price: number;
  priceText: string;
  source: string;
  imageUrl: string;
  productUrl: string;
}

interface ProductDetail extends Product {
  location?: string;
  description: string;
  condition: string;
  sellerName: string;
  sellerRating?: number;
  additionalImages: string[];
  specifications: Record<string, string>;
  tags: string[];
  viewCount?: number;
  likeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductAnalysis {
  id: string;
  valueRating: number;
  pros: string[];
  cons: string[];
  conditionScore: number;
  priceScore: number;
  extractedCondition?: string; // AI-extracted condition info
  extractedSellerInfo?: string; // AI-extracted seller info
}

interface ComparisonAnalysis {
  comparison: Record<string, string | Record<string, string>>;
  products: ProductAnalysis[];
  bestValue: {
    productId: string;
    reason: string;
  };
  recommendations: string;
  summary: string;
}

interface ComparisonResponse {
  success: boolean;
  analysis: ComparisonAnalysis;
  detailedProducts: ProductDetail[];
}

export default function ComparisonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [detailedProducts, setDetailedProducts] = useState<ProductDetail[]>([]);
  const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🚀 Comparison page useEffect triggered");

    const productData = searchParams.get("products");
    const productIds = searchParams.get("ids");
    const fullURL = typeof window !== "undefined" ? window.location.href : "undefined";

    console.log("🔍 Comparison page URL params:", {
      productData: productData ? `exists (${productData.length} chars)` : "null",
      productIds: productIds ? `exists (${productIds.length} chars)` : "null",
      fullURL,
      searchParamsSize: searchParams.toString().length,
      allParams: Object.fromEntries(searchParams.entries()),
    });

    if (productData) {
      // New format with full product data
      try {
        console.log("📦 Raw product data (first 300 chars):", productData.substring(0, 300));
        console.log("📦 Raw product data (last 100 chars):", productData.slice(-100));

        // Safely decode URI with error handling
        let decodedData;
        try {
          decodedData = decodeURIComponent(productData);
          console.log("🔓 Decoded data (first 300 chars):", decodedData.substring(0, 300));
        } catch (decodeError) {
          console.error("❌ URI decoding failed:", decodeError);
          // Try using the raw data if decoding fails
          decodedData = productData;
          console.log("🔄 Using raw data instead:", decodedData.substring(0, 300));
        }

        const parsedProducts = JSON.parse(decodedData);
        console.log("✅ Parsed products:", {
          count: Array.isArray(parsedProducts) ? parsedProducts.length : "not array",
          types: Array.isArray(parsedProducts) ? parsedProducts.map((p) => typeof p) : "not array",
          firstProduct:
            Array.isArray(parsedProducts) && parsedProducts[0]
              ? {
                  id: parsedProducts[0].id,
                  title: parsedProducts[0].title,
                  source: parsedProducts[0].source,
                }
              : "no first product",
        });

        if (Array.isArray(parsedProducts) && parsedProducts.length >= 2) {
          console.log("✅ Valid products array, starting comparison...");
          fetchComparison(parsedProducts);
        } else {
          console.error("❌ Invalid products array:", {
            isArray: Array.isArray(parsedProducts),
            length: Array.isArray(parsedProducts) ? parsedProducts.length : "not array",
            data: parsedProducts,
          });
          setError("비교할 제품을 최소 2개 선택해주세요.");
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ 제품 데이터 파싱 오류:", err);
        console.error("❌ Failed to parse product data:", {
          rawData: productData.substring(0, 500),
          error: err instanceof Error ? err.message : String(err),
        });
        setError("제품 정보를 불러올 수 없습니다. 데이터 파싱 실패.");
        setLoading(false);
      }
    } else if (productIds) {
      // Old format with IDs only - redirect to search with error
      console.log("⚠️ Old format detected, productIds:", productIds);
      setError("이전 버전의 링크입니다. 검색 페이지에서 다시 제품을 선택해주세요.");
      setLoading(false);
      setTimeout(() => {
        console.log("🔄 Redirecting to search page...");
        router.push("/search");
      }, 3000);
    } else {
      console.error("❌ No product data found in URL parameters");
      console.error("❌ Available search params:", Object.fromEntries(searchParams.entries()));
      setError("비교할 제품 정보가 없습니다. URL에서 제품 데이터를 찾을 수 없습니다.");
      setLoading(false);
    }
  }, [searchParams, router]);

  const fetchComparison = async (products: Product[]) => {
    setLoading(true);
    setError(null);

    try {
      console.log("🔄 비교 분석 요청 중...", products.length + "개 제품");

      const response = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ products }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "비교 분석을 불러오는데 실패했습니다.");
      }

      const data: ComparisonResponse = await response.json();

      if (data.success) {
        setDetailedProducts(data.detailedProducts);
        setAnalysis(data.analysis);
        console.log("✅ 비교 분석 완료");
        console.log("📊 Analysis data:", data.analysis);
        console.log("📦 Detailed products:", data.detailedProducts);
      } else {
        throw new Error("비교 분석에 실패했습니다.");
      }
    } catch (err) {
      console.error("❌ 비교 분석 오류:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <DynamicLoader
          type="comparison"
          subtitle="AI가 선택한 상품들을 꼼꼼히 비교 분석하고 있습니다."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Card className="rounded-xl border-red-200">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4 text-4xl">❌</div>
            <h3 className="text-lg font-semibold mb-2 text-red-600">비교 분석 오류</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              onClick={() => router.push("/search")}
              className="bg-brand-500 hover:bg-brand-600"
            >
              검색페이지로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getBestValueProduct = () => {
    if (!analysis) return null;
    return detailedProducts.find((p) => p.id === analysis.bestValue.productId);
  };

  const bestProduct = getBestValueProduct();

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {/* 뒤로가기 버튼과 테마 토글 */}
      <div className="mb-4 sm:mb-6 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="hover:bg-brand-50 border-brand-200 text-brand-500 h-10 sm:h-12"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          검색으로 돌아가기
        </Button>
        <ThemeToggle />
      </div>

      {loading ? (
        <DynamicLoader
          type="comparison"
          subtitle="AI가 선택한 상품들을 꼼꼼히 비교 분석하고 있습니다."
        />
      ) : error ? (
        <Card className="rounded-xl border-red-200">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4 text-4xl">❌</div>
            <h3 className="text-lg font-semibold mb-2 text-red-600">비교 분석 오류</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              onClick={() => router.push("/search")}
              className="bg-brand-500 hover:bg-brand-600"
            >
              검색페이지로 이동
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {/* 페이지 헤더 */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              🔍 AI 상품 비교 분석
            </h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              선택하신 {detailedProducts.length}개 상품을 AI가 분석하여 최적의 선택을 도와드립니다
            </p>
          </div>

          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">제품 비교 분석</h1>
            {bestProduct && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 px-3 py-1">
                <Star className="w-4 h-4 mr-1" />
                추천: {bestProduct.title.substring(0, 20)}...
              </Badge>
            )}
          </div>

          {/* 제품 카드들 - 상세 정보 포함 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {detailedProducts.map((product) => {
              const productAnalysis = analysis?.products.find((p) => p.id === product.id);
              const isBestValue = analysis?.bestValue.productId === product.id;

              return (
                <Card
                  key={product.id}
                  className={`rounded-xl ${
                    isBestValue ? "ring-2 ring-yellow-400 bg-yellow-50" : ""
                  }`}
                >
                  {isBestValue && (
                    <div className="bg-yellow-400 text-yellow-900 text-center py-2 rounded-t-xl font-medium text-sm sm:text-base">
                      🏆 AI 추천 제품
                    </div>
                  )}

                  <div className="aspect-video bg-gray-100 rounded-t-xl overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<div class="w-full h-full flex items-center justify-center text-gray-400"><div class="text-center"><div class="text-4xl mb-2">📱</div><div class="text-sm">이미지 없음</div></div></div>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📱</div>
                          <div className="text-sm">이미지 없음</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <Badge
                        className="text-white text-xs sm:text-sm"
                        style={{ backgroundColor: getSourceColor(product.source) }}
                      >
                        {getSourceName(product.source)}
                      </Badge>
                      {productAnalysis && (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 mr-1" />
                          <span className="font-bold text-sm sm:text-base">
                            {productAnalysis.valueRating}/10
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-semibold leading-tight line-clamp-2">
                      {product.title}
                    </h3>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xl sm:text-2xl font-bold text-brand-500 truncate">
                        {product.priceText}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(product.productUrl, "_blank")}
                        className="flex-shrink-0 h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm"
                      >
                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        보기
                      </Button>
                    </div>

                    {/* 상세 정보 */}
                    <div className="space-y-2 sm:space-y-3 border-t pt-3 sm:pt-4">
                      <div className="flex items-center text-xs sm:text-sm text-gray-600">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          판매자:{" "}
                          {
                            // Use AI-extracted seller info if available, otherwise use scraped data
                            productAnalysis?.extractedSellerInfo || product.sellerName
                          }
                        </span>
                      </div>

                      {product.location && (
                        <div className="flex items-center text-xs sm:text-sm text-gray-600">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                          <span className="truncate">위치: {product.location}</span>
                        </div>
                      )}

                      <div className="flex items-center text-xs sm:text-sm text-gray-600">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          상태:{" "}
                          {
                            // Use AI-extracted condition if available, otherwise use scraped data
                            productAnalysis?.extractedCondition || product.condition
                          }
                        </span>
                      </div>

                      {product.description && (
                        <div className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2 sm:p-3 rounded-lg">
                          <p className="line-clamp-2 sm:line-clamp-3">{product.description}</p>
                        </div>
                      )}

                      {/* 사양 정보 */}
                      {Object.keys(product.specifications).length > 0 && (
                        <div className="text-sm">
                          <h4 className="font-medium mb-2">제품 사양:</h4>
                          <div className="space-y-1">
                            {Object.entries(product.specifications)
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-600">{key}:</span>
                                  <span className="font-medium">{value}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* 장단점 */}
                      {productAnalysis && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center text-green-600 text-xs sm:text-sm font-medium mb-1">
                              <TrendingUp className="w-3 h-3 mr-1 flex-shrink-0" />
                              장점
                            </div>
                            <ul className="text-xs text-green-700 space-y-1">
                              {productAnalysis.pros.slice(0, 2).map((pro, i) => (
                                <li key={i} className="flex items-start">
                                  <CheckCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs leading-tight">{pro}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="flex items-center text-red-600 text-xs sm:text-sm font-medium mb-1">
                              <TrendingDown className="w-3 h-3 mr-1 flex-shrink-0" />
                              단점
                            </div>
                            <ul className="text-xs text-red-700 space-y-1">
                              {productAnalysis.cons.slice(0, 2).map((con, i) => (
                                <li key={i} className="flex items-start">
                                  <AlertCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs leading-tight">{con}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* AI 분석 결과 */}
          {analysis && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center">🤖 AI 종합 비교 분석</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 분석 요약 */}
                {analysis.summary && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <div className="font-medium mb-1">분석 요약</div>
                      <div>{analysis.summary}</div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* 카테고리별 비교 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">📊 카테고리별 비교</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(analysis.comparison).map(([key, value]) => {
                      // Handle both string and object values from AI response
                      const renderValue = () => {
                        if (typeof value === "string") {
                          return value;
                        } else if (typeof value === "object" && value !== null) {
                          // If it's an object, try to extract the most relevant content
                          const objValue = value as Record<string, string>;

                          // Priority order for extracting meaningful info
                          const priorityKeys = [
                            "가성비",
                            "상태 비교",
                            "신뢰도",
                            "사양 비교",
                            "위치 편의성",
                            "비교",
                            "분석",
                            "결과",
                            "평가",
                          ];

                          // Try to find a priority key first
                          for (const key of priorityKeys) {
                            if (key in objValue && objValue[key]) {
                              return objValue[key];
                            }
                          }

                          // If no priority key found, combine all non-empty string values
                          const values = Object.values(objValue)
                            .filter((v) => typeof v === "string" && v.trim().length > 0)
                            .join(" | ");

                          return values || "정보 없음";
                        }
                        return String(value);
                      };

                      return (
                        <div key={key} className="bg-gray-50 rounded-lg p-4">
                          <div className="font-medium text-brand-600 mb-2">{key}</div>
                          <div className="text-gray-700 text-sm">{renderValue()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* 최고 가성비 제품 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">🏆 최고 가성비 제품</h3>
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <Star className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <div className="font-medium mb-1">추천: {bestProduct?.title}</div>
                      <div>{analysis.bestValue.reason}</div>
                    </AlertDescription>
                  </Alert>
                </div>

                <Separator />

                {/* 구매 가이드 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">💡 구매 가이드</h3>
                  <div className="bg-brand-50 rounded-lg p-4 text-brand-800">
                    {analysis.recommendations}
                  </div>
                </div>

                <Separator />

                {/* 점수 비교 차트 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">📈 점수 비교</h3>
                  <div className="space-y-4">
                    {analysis.products.map((productAnalysis) => {
                      const product = detailedProducts.find((p) => p.id === productAnalysis.id);
                      if (!product) return null;

                      return (
                        <div key={productAnalysis.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{product.title.substring(0, 40)}...</h4>
                            <Badge
                              variant={
                                analysis.bestValue.productId === productAnalysis.id
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              총점: {productAnalysis.valueRating}/10
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-gray-600 mb-1">가격 점수</div>
                              <div className="flex items-center">
                                <div className="bg-gray-200 rounded-full h-2 flex-1 mr-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${productAnalysis.priceScore * 10}%` }}
                                  />
                                </div>
                                <span className="font-medium">{productAnalysis.priceScore}/10</span>
                              </div>
                            </div>

                            <div>
                              <div className="text-gray-600 mb-1">상태 점수</div>
                              <div className="flex items-center">
                                <div className="bg-gray-200 rounded-full h-2 flex-1 mr-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${productAnalysis.conditionScore * 10}%` }}
                                  />
                                </div>
                                <span className="font-medium">
                                  {productAnalysis.conditionScore}/10
                                </span>
                              </div>
                            </div>

                            <div>
                              <div className="text-gray-600 mb-1">종합 점수</div>
                              <div className="flex items-center">
                                <div className="bg-gray-200 rounded-full h-2 flex-1 mr-2">
                                  <div
                                    className="bg-yellow-500 h-2 rounded-full"
                                    style={{ width: `${productAnalysis.valueRating * 10}%` }}
                                  />
                                </div>
                                <span className="font-medium">
                                  {productAnalysis.valueRating}/10
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Settings,
  ArrowUpDown,
  Eye,
  Plus,
  Loader2,
  Sparkles,
  Zap,
  Star,
} from "lucide-react";
import DynamicLoader from "@/components/ui/dynamic-loader";
import { formatPrice, getSourceName, getSourceColor } from "@/lib/utils";

// Product 타입 정의 (검색 페이지용, id로 변경)
interface Product {
  id: string;
  title: string;
  price: number;
  priceText: string;
  source: string;
  imageUrl: string;
  productUrl: string;
  location?: string;
}

interface SearchResponse {
  products: Product[];
  count: number;
  executionTime: number;
}

// 🤖 AI 추천 응답 타입
interface AIRecommendResponse {
  success: boolean;
  recommendedIds: string[];
  reasoning?: string;
  executionTime: number;
  error?: string;
}

// 실제 API 호출 함수
const searchProducts = async (
  query: string,
  sources: string[],
  minPrice: number,
  maxPrice: number
): Promise<SearchResponse> => {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      sources,
      limit: 20,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "검색 중 오류가 발생했습니다.");
  }

  const data = await response.json();

  // 가격 필터링 (API에서 처리하지 않으므로 클라이언트에서 처리)
  const filteredProducts = data.products.filter(
    (product: Product) => product.price >= minPrice && product.price <= maxPrice
  );

  return {
    ...data,
    products: filteredProducts,
    count: filteredProducts.length,
  };
};

// 🤖 AI 추천 API 호출 함수
const getAIRecommendations = async (
  query: string,
  products: Product[]
): Promise<AIRecommendResponse> => {
  const response = await fetch("/api/ai-recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      products,
    }),
  });

  const data = await response.json();
  return data;
};

export default function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryFromUrl = searchParams.get("q") || "";
  const locationFromUrl = searchParams.get("location") || "용답동";

  const [searchQuery, setSearchQuery] = useState(queryFromUrl);
  const [selectedLocation] = useState(locationFromUrl);
  const [keywordFilter, setKeywordFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 5000000]);
  const [selectedSources, setSelectedSources] = useState(["danggeun", "bunjang", "junggonara"]);
  const [sortBy, setSortBy] = useState("price_asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // 검색 실행 여부 추가

  // 🤖 AI 추천 관련 상태
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAIRecommendations, setShowAIRecommendations] = useState(true);

  const tabs = [
    { id: "all", label: "전체", emoji: "🔍", value: null },
    { id: "danggeun", label: "당근마켓", emoji: "🥕", value: "danggeun" },
    { id: "bunjang", label: "번개장터", emoji: "⚡", value: "bunjang" },
    { id: "junggonara", label: "중고나라", emoji: "💼", value: "junggonara" },
  ];

  // 🤖 AI 추천 실행 함수
  const getAIRecommendationsForProducts = useCallback(
    async (products: Product[]) => {
      if (products.length === 0 || !searchQuery.trim()) return;

      setAiLoading(true);
      setAiError(null);

      try {
        console.log("🤖 AI 추천 요청 시작... (gemini-2.0-flash-lite)");
        const result = await getAIRecommendations(searchQuery, products);

        if (result.success) {
          setAiRecommendedIds(result.recommendedIds);
          setAiReasoning(result.reasoning || "");
          console.log(`🤖 AI 추천 완료: ${result.recommendedIds.length}개 상품`);
        } else {
          setAiError(result.error || "AI 추천을 가져올 수 없습니다.");
        }
      } catch (error) {
        console.error("AI 추천 오류:", error);
        setAiError("AI 추천 중 오류가 발생했습니다.");
      } finally {
        setAiLoading(false);
      }
    },
    [searchQuery]
  );

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError("검색어를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    // 🤖 AI 추천 상태 초기화
    setAiRecommendedIds([]);
    setAiReasoning("");
    setAiError(null);

    try {
      const result = await searchProducts(
        searchQuery,
        selectedSources,
        priceRange[0],
        priceRange[1]
      );

      // Debug logging for API response
      console.log("🔍 API Response Debug:", {
        totalProducts: result.products.length,
        sourceCounts: result.products.reduce((acc, p) => {
          acc[p.source] = (acc[p.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bunjangProducts: result.products.filter((p) => p.source === "bunjang").map((p) => p.title),
      });

      setProducts(result.products);
      setSelectedIds([]);

      // 🤖 검색 완료 후 자동으로 AI 추천 실행
      if (result.products.length > 0) {
        setTimeout(() => {
          getAIRecommendationsForProducts(result.products);
        }, 500); // 0.5초 후 AI 추천 시작
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSources, priceRange, getAIRecommendationsForProducts]);

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        // URL 업데이트 (뒤로가기 지원)
        router.push(`/search?q=${encodeURIComponent(searchQuery)}&location=${selectedLocation}`);
        doSearch();
      }
    },
    [searchQuery, selectedLocation, router, doSearch]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const goCompare = useCallback(() => {
    // Get the full product objects for the selected IDs
    const selectedProducts = products.filter((product) => selectedIds.includes(product.id));

    if (selectedProducts.length >= 2) {
      try {
        // Clean and sanitize product data for safer encoding
        const cleanProducts = selectedProducts.map((product) => ({
          ...product,
          title: product.title.replace(/[\u200B-\u200D\uFEFF]/g, ""), // Remove zero-width spaces
        }));

        // Encode the full product objects as JSON with safer encoding
        const jsonString = JSON.stringify(cleanProducts);
        const encodedProducts = encodeURIComponent(jsonString);

        console.log("🔄 Navigating to comparison with", cleanProducts.length, "products");
        console.log(
          "📏 JSON length:",
          jsonString.length,
          "Encoded length:",
          encodedProducts.length
        );

        router.push(`/compare?products=${encodedProducts}`);
      } catch (error) {
        console.error("❌ Error encoding products for comparison:", error);
        // Fallback: try with minimal data
        try {
          const minimalProducts = selectedProducts.map((product) => ({
            id: product.id,
            title: product.title.substring(0, 100), // Truncate title
            price: product.price,
            priceText: product.priceText,
            source: product.source,
            productUrl: product.productUrl,
            imageUrl: product.imageUrl,
            location: product.location || "",
            description: product.title, // Use title as description fallback
          }));
          const encodedProducts = encodeURIComponent(JSON.stringify(minimalProducts));
          router.push(`/compare?products=${encodedProducts}`);
        } catch (fallbackError) {
          console.error("❌ Fallback encoding also failed:", fallbackError);
          alert("비교 페이지로 이동하는데 문제가 발생했습니다. 다시 시도해주세요.");
        }
      }
    }
  }, [router, selectedIds, products]);

  const handleSourcesChange = useCallback((value: string) => {
    const newSources = value.split(",").filter(Boolean);
    setSelectedSources(newSources);
  }, []);

  // URL에서 쿼리가 있을 때만 자동 검색 (최초 로드 시)
  useEffect(() => {
    if (queryFromUrl && !hasSearched) {
      doSearch();
    }
  }, [queryFromUrl, doSearch, hasSearched]);

  // 필터링 및 정렬
  const tokens = keywordFilter.split(/[,\s]+/).filter((t) => t);
  const includeKeys = tokens.filter((t) => t.startsWith("+")).map((t) => t.slice(1));
  const excludeKeys = tokens.filter((t) => t.startsWith("-")).map((t) => t.slice(1));

  // Debug logging for product filtering
  console.log("🔍 Frontend Debug:", {
    totalProducts: products.length,
    sourceCounts: products.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    activeTab,
    selectedSources,
    priceRange,
  });

  const filtered = products
    .filter((p) => (activeTab === "all" ? true : p.source === activeTab))
    .filter((p) => selectedSources.includes(p.source))
    .filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1])
    .filter((p) => includeKeys.every((k) => p.title.includes(k)))
    .filter((p) => excludeKeys.every((k) => !p.title.includes(k)));

  const sorted = [...filtered].sort((a, b) =>
    sortBy === "price_asc" ? a.price - b.price : b.price - a.price
  );

  // Debug logging for final results
  console.log("📊 Filtered Results:", {
    filteredCount: filtered.length,
    finalCount: sorted.length,
    bunjangFiltered: filtered.filter((p) => p.source === "bunjang").length,
    bunjangFinal: sorted.filter((p) => p.source === "bunjang").length,
  });

  // 🤖 AI 추천 상품 여부 확인 함수
  const isAIRecommended = useCallback(
    (productId: string): boolean => {
      return aiRecommendedIds.includes(productId);
    },
    [aiRecommendedIds]
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 섹션 */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => router.push("/")}
            >
              <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                🔍
              </div>
              <span className="text-xl font-bold text-brand-500">더나와</span>
            </div>

            <Badge variant="outline" className="text-brand-500 border-brand-200">
              <MapPin className="w-3 h-3 mr-1" />
              {selectedLocation}
            </Badge>
          </div>

          {/* 검색 바 */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-8">
                <div className="relative">
                  <Input
                    placeholder="찾고 있는 상품을 검색해보세요"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 pr-12 rounded-xl border-2 focus:border-brand-500"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-brand-500 hover:bg-brand-600"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="w-full h-12 bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
                </Button>
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full h-12 border-brand-200 text-brand-500 hover:bg-brand-50 rounded-xl"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  필터
                </Button>
              </div>
            </div>
          </form>

          {/* 검색 전 안내 메시지 */}
          {!hasSearched && !queryFromUrl && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">검색어를 입력하고 엔터를 눌러주세요</h3>
              <p className="text-gray-600">당근마켓, 번개장터, 중고나라에서 상품을 찾아드립니다</p>
            </div>
          )}

          {/* 비교 버튼 */}
          {selectedIds.length >= 2 && (
            <div className="mb-4">
              <Button onClick={goCompare} className="bg-red-500 hover:bg-red-600 rounded-xl">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                상품 비교하기 ({selectedIds.length}개)
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* 검색이 실행된 경우에만 탭과 필터 표시 */}
        {hasSearched && (
          <>
            {/* 🤖 AI 추천 상태 표시 */}
            {(aiLoading || aiRecommendedIds.length > 0 || aiError) && (
              <Card className="rounded-xl mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-amber-700 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      AI 추천 상품
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      {showAIRecommendations ? "숨기기" : "보기"}
                    </Button>
                  </div>
                </CardHeader>
                {showAIRecommendations && (
                  <CardContent>
                    {aiLoading ? (
                      <div className="py-4">
                        <DynamicLoader
                          type="ai-analysis"
                          showProgress={true}
                          subtitle="상품을 분석하여 최적의 추천을 찾고 있습니다."
                        />
                      </div>
                    ) : aiError ? (
                      <div className="text-red-600 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{aiError}</span>
                      </div>
                    ) : aiRecommendedIds.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-amber-700">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">
                            {aiRecommendedIds.length}개 상품을 AI가 추천했습니다!
                          </span>
                        </div>
                        {aiReasoning && (
                          <p className="text-sm text-amber-600 bg-amber-100 p-3 rounded-lg">
                            💡 {aiReasoning}
                          </p>
                        )}
                        <p className="text-xs text-amber-600">
                          ✨ 황금색 테두리로 표시된 상품들이 AI 추천 상품입니다
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            )}

            {/* 플랫폼 탭 */}
            <Card className="rounded-xl mb-6 border-brand-200">
              <CardContent className="p-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-brand-100 data-[state=active]:text-brand-700"
                      >
                        <span className="mr-2">{tab.emoji}</span>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* 필터 섹션 */}
            {showFilters && (
              <Card className="rounded-xl mb-6 border-brand-200">
                <CardHeader>
                  <CardTitle className="text-brand-500">🎛️ 세부 필터</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium mb-2 block">검색 대상 플랫폼</label>
                      <Select value={selectedSources.join(",")} onValueChange={handleSourcesChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="플랫폼 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="danggeun">🥕 당근마켓</SelectItem>
                          <SelectItem value="bunjang">⚡ 번개장터</SelectItem>
                          <SelectItem value="junggonara">💼 중고나라</SelectItem>
                          <SelectItem value="danggeun,bunjang,junggonara">모든 플랫폼</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">정렬 기준</label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="price_asc">💰 가격 낮은 순</SelectItem>
                          <SelectItem value="price_desc">💎 가격 높은 순</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        💵 가격 범위: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                      </label>
                      <Slider
                        value={priceRange}
                        onValueChange={setPriceRange}
                        min={0}
                        max={5000000}
                        step={10000}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">🔍 키워드 필터</label>
                    <Input
                      placeholder="+포함할키워드, -제외할키워드 (쉼표로 구분)"
                      value={keywordFilter}
                      onChange={(e) => setKeywordFilter(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      + 기호로 포함할 키워드, - 기호로 제외할 키워드를 지정하세요
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* 검색 결과 */}
        {loading ? (
          <DynamicLoader type="search" subtitle="검색 조건에 맞는 상품을 찾고 있습니다." />
        ) : error ? (
          <Card className="rounded-xl border-red-200">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-2">❌</div>
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : hasSearched ? (
          <>
            {/* 검색 결과 헤더 */}
            {sorted.length > 0 && (
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  📦 `{searchQuery}` 검색 결과 ({sorted.length}개)
                </h2>
              </div>
            )}

            {/* 상품 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((product) => {
                const isRecommended = isAIRecommended(product.id);
                return (
                  <Card
                    key={product.id}
                    className={`rounded-xl border-2 transition-all hover:scale-105 hover:shadow-lg relative ${
                      isRecommended
                        ? "border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 shadow-amber-200 shadow-lg ring-2 ring-amber-200"
                        : selectedIds.includes(product.id)
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:border-brand-300"
                    }`}
                  >
                    {/* 🤖 AI 추천 배지 */}
                    {isRecommended && (
                      <div className="absolute top-3 left-3 z-10">
                        <Badge className="bg-amber-500 text-white shadow-lg border-amber-600 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-white" />
                          AI 추천
                        </Badge>
                      </div>
                    )}

                    <div className="aspect-video bg-gray-100 rounded-t-xl overflow-hidden relative">
                      {/* 🔥 이미지 오류 처리 개선 */}
                      {product.imageUrl && product.imageUrl.trim() ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          onError={(e) => {
                            // 이미지 로드 실패 시 기본 이미지로 교체
                            const target = e.target as HTMLImageElement;
                            target.src =
                              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgODBDOTQuNDc3MiA4MCA5MCA4NC40NzcyIDkwIDkwVjExMEM5MCA5NC40NzcyIDg1LjUyMjggOTAgODAgOTBINzBDNjQuNDc3MiA5MCA2MCA5NC40NzcyIDYwIDEwMFYxMzBDNjAgMTM1LjUyMyA2NC40NzcyIDE0MCA3MCAxNDBIMTMwQzEzNS41MjMgMTQwIDE0MCAxMzUuNTIzIDE0MCAxMzBWMTAwQzE0MCA5NC40NzcyIDEzNS41MjMgOTAgMTMwIDkwSDEyMEMxMTQuNDc3IDkwIDExMCA5NC40NzcyIDExMCAxMDBWMTEwQzExMCAxMDQuNDc3IDEwNS41MjMgMTAwIDEwMCAxMDBaIiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUNBM0FGIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iQXJpYWwiPuydtOuvuOyngDwvdGV4dD4KPC9zdmc+";
                          }}
                          priority={false}
                        />
                      ) : (
                        // 이미지가 없을 때 기본 플레이스홀더
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <div className="text-center text-gray-400">
                            <svg
                              width="40"
                              height="40"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z"
                                fill="currentColor"
                              />
                            </svg>
                            <p className="text-xs mt-1">이미지 없음</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          className="mb-2"
                          style={{
                            backgroundColor: getSourceColor(product.source),
                            color: "#fff",
                          }}
                        >
                          {getSourceName(product.source)}
                        </Badge>
                        {/* 🤖 AI 추천 아이콘 */}
                        {isRecommended && (
                          <div className="text-amber-500">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold mb-2 line-clamp-2">{product.title}</h3>
                      <p
                        className={`text-xl font-bold ${
                          isRecommended ? "text-amber-600" : "text-brand-500"
                        }`}
                      >
                        {product.priceText}
                      </p>
                      {product.location && (
                        <p className="text-sm text-gray-600 mt-1">📍 {product.location}</p>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 pt-0 space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(product.productUrl)}
                        className={`${
                          isRecommended
                            ? "text-amber-600 border-amber-300 hover:bg-amber-50"
                            : "text-brand-500 border-brand-200 hover:bg-brand-50"
                        }`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        보기
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedIds.includes(product.id) ? "default" : "outline"}
                        onClick={() => toggleSelect(product.id)}
                        className={
                          selectedIds.includes(product.id)
                            ? "bg-brand-500 hover:bg-brand-600"
                            : isRecommended
                            ? "text-amber-600 border-amber-300 hover:bg-amber-50"
                            : "text-brand-500 border-brand-200 hover:bg-brand-50"
                        }
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {selectedIds.includes(product.id) ? "선택됨" : "선택"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/product/${product.id}`)}
                        className={`${
                          isRecommended
                            ? "text-amber-600 border-amber-300 hover:bg-amber-50"
                            : "text-brand-500 border-brand-200 hover:bg-brand-50"
                        }`}
                      >
                        상세
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* 검색 결과 없음 */}
            {sorted.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">검색 결과가 없습니다</h3>
                <p className="text-gray-600 mb-4">
                  `{searchQuery}` 에 대한 검색 결과를 찾을 수 없습니다.
                </p>
                <div className="text-sm text-gray-500">
                  <p>• 다른 키워드로 검색해보세요</p>
                  <p>• 검색어의 맞춤법을 확인해보세요</p>
                  <p>• 더 간단한 키워드를 사용해보세요</p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

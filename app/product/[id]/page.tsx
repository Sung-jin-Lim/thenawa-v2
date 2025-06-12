"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowUpDown,
  MapPin,
  User,
  Tag,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import DynamicLoader from "@/components/ui/dynamic-loader";
import { formatPrice, getSourceName, getSourceColor } from "@/lib/utils";

interface Product {
  id: string;
  title: string;
  price: number;
  priceText: string;
  source: string;
  imageUrl: string;
  productUrl: string;
  location?: string;
  description?: string;
  condition?: string;
  sellerName?: string;
  images?: string[];
  specs?: Record<string, string>;
  timestamp?: string;
}

interface MarketProduct {
  id: string;
  title: string;
  price: number;
  priceText: string;
  source: string;
  imageUrl: string;
  productUrl: string;
}

interface MarketAnalysis {
  marketPrice: number;
  disparity: number;
  disparityPercentage: number;
  marketProducts: MarketProduct[];
}

interface ProductDetailResponse {
  product: Product;
  similarProducts: Product[];
  marketAnalysis: MarketAnalysis;
}

interface ProductDetailProps {
  params: Promise<{
    id: string;
  }>;
}

// API function that can use URL product data or fetch from API
const getProductDetails = async (
  id: string,
  productDataFromUrl?: string
): Promise<ProductDetailResponse> => {
  try {
    console.log("🔍 Fetching product details for ID:", id);

    // First try to use product data from URL if available
    if (productDataFromUrl) {
      try {
        const product = JSON.parse(decodeURIComponent(productDataFromUrl));
        console.log("📦 Using product data from URL:", product.title);

        // Call API with product data for detailed scraping
        const response = await fetch(
          `/api/products/${encodeURIComponent(id)}?productData=${productDataFromUrl}`
        );

        if (response.ok) {
          const data = await response.json();
          return data;
        } else {
          // If API fails, create response from URL data
          console.log("⚠️ API failed, using URL data directly");
          return {
            product: {
              ...product,
              specs: product.specs || {},
              images: product.images || [product.imageUrl],
              description:
                product.description ||
                `${product.title} - ${product.source}에서 판매 중인 상품입니다.`,
              condition: product.condition || "상태 정보 없음",
              sellerName: product.sellerName || "판매자",
            },
            similarProducts: [],
            marketAnalysis: {
              marketPrice: Math.round(product.price * 1.3),
              disparity: Math.round(product.price * 0.3),
              disparityPercentage: 30,
              marketProducts: [],
            },
          };
        }
      } catch (parseError) {
        console.error("❌ Error parsing URL product data:", parseError);
      }
    }

    // Fallback to API only (will probably fail without product data)
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ Error fetching product details:", error);

    // Fallback: create basic product info from ID if possible
    const fallbackProduct: Product = {
      id: id,
      title: "상품 정보를 불러올 수 없습니다",
      price: 0,
      priceText: "가격 정보 없음",
      source: "danggeun",
      imageUrl: "/api/placeholder/400/300",
      productUrl: "#",
      location: "위치 정보 없음",
      description: "상품 상세 정보를 불러오는 중 오류가 발생했습니다.",
      condition: "정보 없음",
      sellerName: "판매자 정보 없음",
      images: ["/api/placeholder/400/300"],
      specs: {
        오류: "상품 정보를 불러올 수 없습니다",
      },
      timestamp: new Date().toISOString(),
    };

    return {
      product: fallbackProduct,
      similarProducts: [],
      marketAnalysis: {
        marketPrice: 0,
        disparity: 0,
        disparityPercentage: 0,
        marketProducts: [],
      },
    };
  }
};

export default function ProductDetailPage({ params }: ProductDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState<string>("");

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setProductId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  const fetchProductDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const productDataParam = searchParams.get("productData");
      const response = await getProductDetails(productId, productDataParam || undefined);
      setProduct(response.product);
      setSimilarProducts(response.similarProducts);
      setMarketAnalysis(response.marketAnalysis);
    } catch (err) {
      // console.error 제거
      setError("상품 정보를 불러오는데 실패했습니다." + err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <DynamicLoader type="general" subtitle="상품 상세 정보를 불러오고 있습니다." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <Alert className="mb-4">
          <AlertDescription>상품을 찾을 수 없습니다.</AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={() => router.push("/search")}>검색으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* 뒤로가기 버튼 */}
        <Button variant="outline" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          돌아가기
        </Button>

        {/* 상품 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 이미지 */}
          <Card className="rounded-xl">
            <CardContent className="p-0">
              <div className="aspect-square bg-gray-100 rounded-t-xl overflow-hidden">
                <img
                  src={product.images?.[0] || product.imageUrl}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 p-4 overflow-x-auto">
                  {product.images.map((img: string, i: number) => (
                    <div
                      key={i}
                      className={`w-20 h-20 flex-shrink-0 border-2 rounded-lg overflow-hidden ${
                        i === 0 ? "border-brand-500" : "border-gray-200"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.title} ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 상품 정보 */}
          <Card className="rounded-xl h-fit">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <Badge
                  className="text-white"
                  style={{ backgroundColor: getSourceColor(product.source) }}
                >
                  {getSourceName(product.source)}
                </Badge>
                {product.timestamp && (
                  <span className="text-sm text-gray-500">
                    {new Date(product.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold mb-4">{product.title}</h1>

              <div className="text-3xl font-bold text-brand-500 mb-6">{product.priceText}</div>

              {/* 시장가 비교 */}
              {marketAnalysis && (
                <Alert className="mb-6 bg-green-50 border-green-200">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <div className="font-semibold">
                      시장가 대비 {marketAnalysis.disparityPercentage.toFixed(1)}% 저렴
                    </div>
                    <div className="text-sm">
                      시장가: {formatPrice(marketAnalysis.marketPrice)} | 절약:{" "}
                      {formatPrice(marketAnalysis.disparity)}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* 상품 세부 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {product.location && (
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                    {product.location}
                  </div>
                )}
                {product.sellerName && (
                  <div className="flex items-center text-sm">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    판매자: {product.sellerName}
                  </div>
                )}
                {product.condition && (
                  <div className="flex items-center text-sm">
                    <Tag className="w-4 h-4 mr-2 text-gray-500" />
                    상태: {product.condition}
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              {/* 상품 설명 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">제품 설명</h3>
                <p className="text-gray-700 leading-relaxed">{product.description}</p>
              </div>

              {/* 액션 버튼 */}
              <div className="space-y-3">
                <Button
                  className="w-full bg-brand-500 hover:bg-brand-600"
                  onClick={() => window.open(product.productUrl, "_blank")}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  원본 페이지에서 보기
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-brand-200 text-brand-500 hover:bg-brand-50"
                  onClick={() =>
                    router.push(
                      `/search?q=${encodeURIComponent(
                        product.title.split(" ").slice(0, 2).join(" ")
                      )}`
                    )
                  }
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  다른 제품과 비교하기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 제품 사양 */}
        {product.specs && (
          <Card className="rounded-xl mb-8">
            <CardHeader>
              <CardTitle>제품 사양</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {Object.entries(product.specs).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium w-1/3">{key}</TableCell>
                      <TableCell>{value as string}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 시장가 비교 테이블 */}
        {marketAnalysis?.marketProducts && marketAnalysis.marketProducts.length > 0 && (
          <Card className="rounded-xl mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowUpDown className="w-5 h-5 mr-2" />
                시장가 비교
              </CardTitle>
              <p className="text-sm text-gray-600">
                쿠팡에서 판매 중인 동일/유사 제품과의 가격 비교
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제품명</TableHead>
                    <TableHead className="text-right">가격</TableHead>
                    <TableHead className="text-right">차이</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketAnalysis.marketProducts.map((marketProduct: MarketProduct) => {
                    const diff = marketProduct.price - product.price;
                    const pct = (diff / marketProduct.price) * 100;
                    return (
                      <TableRow key={marketProduct.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Badge
                              className="mr-2 text-white"
                              style={{ backgroundColor: getSourceColor(marketProduct.source) }}
                            >
                              {getSourceName(marketProduct.source)}
                            </Badge>
                            {marketProduct.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{marketProduct.priceText}</TableCell>
                        <TableCell className="text-right text-green-600 font-bold">
                          {formatPrice(diff)} ({pct.toFixed(1)}%)
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 유사한 제품 */}
        {similarProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">유사한 제품</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarProducts.map((similarProduct) => (
                <Card
                  key={similarProduct.id}
                  className="rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
                  onClick={() => router.push(`/product/${similarProduct.id}`)}
                >
                  <div className="aspect-video bg-gray-100 rounded-t-xl overflow-hidden">
                    <img
                      src={similarProduct.imageUrl}
                      alt={similarProduct.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Badge
                        className="text-white"
                        style={{ backgroundColor: getSourceColor(similarProduct.source) }}
                      >
                        {getSourceName(similarProduct.source)}
                      </Badge>
                      {similarProduct.location && (
                        <span className="text-xs text-gray-500">{similarProduct.location}</span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-2 line-clamp-2">{similarProduct.title}</h3>
                    <p className="text-xl font-bold text-brand-500">{similarProduct.priceText}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

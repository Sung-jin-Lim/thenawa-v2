import { NextRequest, NextResponse } from "next/server";
import { FastProductDetailScraper } from "@/lib/scrapers/fast-product-detail-scraper";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    console.log("🔍 Product detail API called with ID:", id);

    // Decode the product ID to extract URL and source info
    // Product IDs are in format: source_timestamp_urlhash
    // For now, we'll rely on productData parameter instead of parsing the ID

    // Check if we have the product data in the request headers or query params
    const productData = request.nextUrl.searchParams.get("productData");

    if (productData) {
      try {
        const decodedProduct = JSON.parse(decodeURIComponent(productData));
        console.log("📦 Using provided product data:", decodedProduct.title);

        // Use our fast scraper to get detailed info
        const scraper = new FastProductDetailScraper();
        const detailedProducts = await scraper.scrapeProductsDetails([decodedProduct]);

        if (detailedProducts.length > 0) {
          const detailedProduct = detailedProducts[0];

          return NextResponse.json({
            product: {
              ...detailedProduct,
              specs: detailedProduct.specifications || {},
              images: detailedProduct.additionalImages || [detailedProduct.imageUrl],
            },
            similarProducts: [], // We'd need another search API call here
            marketAnalysis: {
              marketPrice: Math.round(detailedProduct.price * 1.3), // Mock 30% higher market price
              disparity: Math.round(detailedProduct.price * 0.3),
              disparityPercentage: 30,
              marketProducts: [], // Mock market products
            },
          });
        }
      } catch (parseError) {
        console.error("❌ Error parsing product data:", parseError);
      }
    }

    // Fallback: Return error for now since we need the original product data
    // In a real implementation, you'd store products in a database and fetch by ID
    return NextResponse.json(
      {
        error: "상품 상세 정보를 불러오려면 원본 상품 데이터가 필요합니다.",
        note: "현재는 검색 결과에서 직접 상세 페이지로 이동해야 합니다.",
      },
      { status: 404 }
    );
  } catch (error) {
    console.error("❌ 상품 상세 API 오류:", error);
    return NextResponse.json({ error: "상품 정보를 불러올 수 없습니다." }, { status: 500 });
  }
}

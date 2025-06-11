import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Environment detection
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

  // Scraper configuration (mirrored from search route)
  const SCRAPER_CONFIG = {
    INDIVIDUAL_TIMEOUT: isVercel ? 28000 : 8000, // 대폭 증가
    DANGGEUN_TIMEOUT: isVercel ? 35000 : 15000,
    TOTAL_TIMEOUT: isVercel ? 38000 : 25000,
    MIN_RESULTS: 6, // 중고나라만으로도 충분
    PARALLEL_LIMIT: isVercel ? 3 : 2,
    VERCEL_FAST_MODE: isVercel,
    GRACEFUL_DEGRADATION: isVercel,
  };

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      isVercel,
      platform: isVercel ? "Vercel" : "Local",
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
    },
    scraperConfig: SCRAPER_CONFIG,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    envVars: {
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      openRouterKeyPreview: process.env.OPENROUTER_API_KEY?.substring(0, 10) + "...",
    },
  };

  console.log("🔍 디버그 정보 조회:", debugInfo);

  return NextResponse.json(debugInfo, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

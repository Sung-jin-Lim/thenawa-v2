import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return NextResponse.json({
    hasOpenRouterKey: !!apiKey,
    keyStart: apiKey?.substring(0, 12) + "...",
    keyLength: apiKey?.length,
    appUrl: appUrl,
    allEnvKeys: Object.keys(process.env).filter(
      (key) =>
        key.includes("OPENROUTER") || key.includes("NEXT_PUBLIC") || key.includes("PUPPETEER")
    ),
    timestamp: new Date().toISOString(),
  });
}

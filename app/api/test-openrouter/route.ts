import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    console.log(`🔑 Testing OpenRouter with API key: ${apiKey?.substring(0, 12)}...`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://thenawa.vercel.app",
        "X-Title": "TheNawa Product Search",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          {
            role: "user",
            content: "Hello, this is a test message. Please respond with 'Test successful!'",
          },
        ],
        max_tokens: 50,
      }),
    });

    const responseText = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

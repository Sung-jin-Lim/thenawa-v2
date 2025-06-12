import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "더나와 - 중고거래 통합검색",
  description:
    "당근마켓, 번개장터, 중고나라를 한번에 검색하고 AI가 추천하는 최적의 상품을 찾아보세요",
  keywords: "중고거래, 당근마켓, 번개장터, 중고나라, 통합검색, AI추천",
  authors: [{ name: "더나와팀" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider defaultTheme="system" storageKey="thenawa-ui-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

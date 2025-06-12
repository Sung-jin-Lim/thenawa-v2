"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Logo, LogoText } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Search, Menu } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}&location=용답동`);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen flex flex-col transition-colors duration-300">
      {/* 헤더 */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo size={32} className="sm:w-10 sm:h-10" />
              <LogoText className="text-lg sm:text-xl" />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-6 items-center">
              <Button variant="ghost" className="text-gray-600 hover:text-brand-500">
                검색
              </Button>
              <Button variant="ghost" className="text-gray-600 hover:text-brand-500">
                비교
              </Button>
              <Button variant="ghost" className="text-gray-600 hover:text-brand-500">
                도움말
              </Button>
              <ThemeToggle />
            </nav>

            {/* Mobile Menu Button & Theme Toggle */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {showMobileMenu && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <nav className="flex flex-col space-y-2">
                <Button
                  variant="ghost"
                  className="justify-start text-gray-600 dark:text-gray-300 hover:text-brand-500"
                >
                  검색
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-gray-600 dark:text-gray-300 hover:text-brand-500"
                >
                  비교
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-gray-600 dark:text-gray-300 hover:text-brand-500"
                >
                  도움말
                </Button>
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* 히어로 섹션 */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 leading-tight">
              다나와? 아니, 더나와.
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-10 lg:mb-12 max-w-2xl mx-auto leading-relaxed px-4">
              당근마켓, 번개장터, 중고나라를 동시에 검색하고 AI가 추천하는 최적의 상품을 찾아보세요
            </p>

            {/* 검색 바 */}
            <form onSubmit={handleSearch} className="mb-8 sm:mb-10 lg:mb-12 px-4">
              <div className="relative max-w-2xl mx-auto">
                <Input
                  placeholder="찾고 있는 상품을 검색해보세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 sm:h-14 lg:h-16 text-base sm:text-lg pr-12 sm:pr-16 rounded-xl sm:rounded-2xl border-2 border-gray-200 focus:border-brand-500 shadow-lg text-center sm:text-left"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 bg-brand-500 hover:bg-brand-600 rounded-lg sm:rounded-xl h-10 sm:h-12 w-10 sm:w-12 p-0"
                >
                  <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-2 px-4">
                예: 아이폰 14, 갤럭시, 맥북, 에어팟
              </p>
            </form>

            {/* 통계 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl mx-auto px-4">
              <div className="text-center bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 backdrop-blur-sm">
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 dark:text-blue-400 mb-2">
                  3개
                </div>
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  연동 플랫폼
                </div>
              </div>
              <div className="text-center bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 backdrop-blur-sm">
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 dark:text-blue-400 mb-2">
                  실시간
                </div>
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  검색 결과
                </div>
              </div>
              <div className="text-center bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 backdrop-blur-sm">
                <div className="text-2xl sm:text-3xl font-bold text-brand-500 dark:text-blue-400 mb-2">
                  AI
                </div>
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  가격 분석
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-white py-8 sm:py-12 mt-auto">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Logo size={28} className="sm:w-8 sm:h-8" />
                <LogoText className="text-lg sm:text-xl" />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                중고거래의 새로운 패러다임을 제시합니다
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">서비스</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">통합검색</li>
                <li className="hover:text-white transition-colors cursor-pointer">가격비교</li>
                <li className="hover:text-white transition-colors cursor-pointer">AI 분석</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">지원</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="hover:text-white transition-colors cursor-pointer">도움말</li>
                <li className="hover:text-white transition-colors cursor-pointer">문의하기</li>
                <li className="hover:text-white transition-colors cursor-pointer">피드백</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-base sm:text-lg">연동 플랫폼</h3>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="text-gray-400 border-gray-600 hover:text-white hover:border-gray-400 transition-colors text-xs sm:text-sm"
                >
                  당근마켓
                </Badge>
                <Badge
                  variant="outline"
                  className="text-gray-400 border-gray-600 hover:text-white hover:border-gray-400 transition-colors text-xs sm:text-sm"
                >
                  번개장터
                </Badge>
                <Badge
                  variant="outline"
                  className="text-gray-400 border-gray-600 hover:text-white hover:border-gray-400 transition-colors text-xs sm:text-sm"
                >
                  중고나라
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-xs sm:text-sm text-gray-400">
            <p>&copy; 2025 더나와. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

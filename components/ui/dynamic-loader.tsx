import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Zap,
  Star,
  Package,
  Sparkles,
  TrendingUp,
  CheckCircle,
  Clock,
} from "lucide-react";

interface DynamicLoaderProps {
  type?: "search" | "ai-analysis" | "comparison" | "general";
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  completed?: boolean; // Add prop to complete progress to 100%
}

const loadingSteps = {
  search: [
    { icon: Search, text: "검색 요청 처리 중...", duration: 2000 },
    { icon: Package, text: "번개장터 상품 수집 중...", duration: 4000 },
    { icon: Package, text: "중고나라 상품 수집 중...", duration: 4000 },
    { icon: Package, text: "당근마켓 상품 수집 중...", duration: 4000 },
    { icon: TrendingUp, text: "결과 정렬 및 정리 중...", duration: 2000 },
    { icon: CheckCircle, text: "검색 완료!", duration: 500 },
  ],
  "ai-analysis": [
    { icon: Brain, text: "AI 모델 초기화 중...", duration: 1500 },
    { icon: Sparkles, text: "상품 데이터 분석 중...", duration: 4000 },
    { icon: Star, text: "추천 상품 선별 중...", duration: 2000 },
    { icon: Zap, text: "분석 완료!", duration: 500 },
  ],
  comparison: [
    { icon: Package, text: "상품 정보 수집 중...", duration: 2500 },
    { icon: Brain, text: "AI 비교 분석 중...", duration: 4500 },
    { icon: TrendingUp, text: "평가 점수 계산 중...", duration: 2000 },
    { icon: CheckCircle, text: "비교 분석 완료!", duration: 500 },
  ],
  general: [
    { icon: Clock, text: "처리 중...", duration: 2000 },
    { icon: TrendingUp, text: "거의 완료...", duration: 2000 },
    { icon: CheckCircle, text: "완료!", duration: 500 },
  ],
};

export default function DynamicLoader({
  type = "general",
  title,
  subtitle,
  showProgress = true,
  completed = false,
}: DynamicLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const steps = loadingSteps[type];

  useEffect(() => {
    if (!showProgress) return;

    let totalTime = 0;
    let currentTime = 0;

    // Calculate total expected time
    steps.forEach((step) => (totalTime += step.duration));

    const interval = setInterval(() => {
      currentTime += 100;

      // More realistic progress calculation - slower at the end
      let baseProgress = (currentTime / totalTime) * 100;

      // Apply easing function to slow down progress near the end
      if (baseProgress > 80) {
        // Slow down significantly after 80%
        const remainingProgress = baseProgress - 80;
        const easedRemaining = remainingProgress * 0.6; // 60% speed after 80%
        baseProgress = 80 + easedRemaining;
      }

      const newProgress = Math.min(baseProgress, completed ? 100 : 95); // Complete to 100% if operation finished
      setProgress(newProgress);

      // Update current step based on elapsed time
      let accumulatedTime = 0;
      for (let i = 0; i < steps.length; i++) {
        accumulatedTime += steps[i].duration;
        if (currentTime <= accumulatedTime) {
          setCurrentStep(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [showProgress, steps, completed]);

  // Handle completion
  useEffect(() => {
    if (completed) {
      setProgress(100);
      setCurrentStep(steps.length - 1); // Jump to final step
    }
  }, [completed, steps.length]);

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData?.icon || Clock;

  return (
    <div className="text-center py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Animated Icon */}
        <div className="relative mb-6">
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity },
            }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-1">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <IconComponent className="w-8 h-8 text-brand-500" />
              </div>
            </div>
          </motion.div>

          {/* Pulsing outer ring */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-brand-300"
          />
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <motion.div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="text-sm text-gray-500">{Math.round(progress)}% 완료</div>
          </div>
        )}

        {/* Title and Subtitle */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-semibold mb-2">
              {title || currentStepData?.text || "처리 중입니다..."}
            </h3>
            {subtitle && <p className="text-gray-600">{subtitle}</p>}
          </motion.div>
        </AnimatePresence>

        {/* Animated dots */}
        <div className="flex justify-center space-x-1 mt-4">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: index * 0.2,
              }}
              className="w-2 h-2 bg-brand-400 rounded-full"
            />
          ))}
        </div>

        {/* Steps indicator */}
        {showProgress && (
          <div className="mt-6 flex justify-center space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index <= currentStep ? "bg-brand-500" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

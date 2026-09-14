"use client";

/**
 * 文章阅读进度条组件
 *
 * 功能：
 * - 在文章详情页显示阅读进度条
 * - 根据页面滚动位置计算阅读进度（0%-100%）
 * - 固定在顶部导航栏下方，滚动时一直可见
 * - 颜色跟随三色主题
 * - 高度 3-4px
 * - 使用 requestAnimationFrame 优化性能
 *
 * 实现方式：
 * - 监听 scroll 事件
 * - 计算：(scrollY - articleTop) / (articleBottom - articleTop - viewportHeight)
 * - 使用 requestAnimationFrame 避免频繁重渲染
 * - 只在文章详情页使用，其他页面不引入
 */

import { useEffect, useState, useRef } from "react";

export function ArticleProgress() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const tickingRef = useRef(false);

  // 计算阅读进度
  const calculateProgress = () => {
    tickingRef.current = false;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // 总可滚动高度
    const scrollableHeight = documentHeight - viewportHeight;

    if (scrollableHeight <= 0) {
      setProgress(0);
      return;
    }

    // 计算进度（0%-100%）
    const currentProgress = Math.min(100, Math.max(0, (scrollY / scrollableHeight) * 100));
    setProgress(currentProgress);
  };

  // 使用 requestAnimationFrame 优化 scroll 事件
  const onScroll = () => {
    if (!tickingRef.current) {
      tickingRef.current = true;
      rafRef.current = requestAnimationFrame(calculateProgress);
    }
  };

  useEffect(() => {
    // 初始计算
    calculateProgress();

    // 监听 scroll 事件
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      className="sticky top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none -mt-[3px]"
      aria-hidden="true"
    >
      {/* 进度条背景（透明，不占视觉空间） */}
      <div className="absolute inset-0 bg-transparent" />

      {/* 进度条主体 */}
      <div
        className="h-full bg-[hsl(var(--ring))] transition-[width] duration-100 ease-out"
        style={{
          width: `${progress}%`,
        }}
      >
        {/* 末端轻微 glow */}
        <div
          className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[hsl(var(--ring))] to-transparent opacity-40"
          style={{ filter: "blur(1px)" }}
        />
      </div>
    </div>
  );
}

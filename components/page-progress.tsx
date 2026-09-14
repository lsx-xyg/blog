"use client";

/**
 * 页面加载进度条组件
 *
 * 功能：
 * - 路由切换时在页面顶部显示加载进度条
 * - 页面初始加载时也显示
 * - 颜色跟随三色主题
 * - 末端带轻微 glow 效果
 * - 高度 2-3px，不占空间
 *
 * 实现方式：
 * - 使用 usePathname 监听路由变化
 * - 路由变化时显示进度条，模拟加载进度（0% -> 90%）
 * - 页面加载完成（useEffect 触发）后进度到 100% 并隐藏
 * - 使用 CSS transition 实现平滑动画
 */

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清除定时器
  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // 开始加载动画（0% -> 90%）
  const startLoading = () => {
    clearTimers();
    setVisible(true);
    setProgress(0);

    // 模拟加载进度，逐渐增加到 90%
    let current = 0;
    timerRef.current = setInterval(() => {
      // 越接近 90% 增加越慢
      const increment = Math.max(0.5, (90 - current) * 0.1);
      current = Math.min(90, current + increment);
      setProgress(current);

      if (current >= 90) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 100);
  };

  // 完成加载（90% -> 100% -> 隐藏）
  const finishLoading = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setProgress(100);

    // 延迟隐藏，让用户看到 100% 的状态
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      // 重置进度，为下次加载做准备
      setTimeout(() => setProgress(0), 300);
    }, 300);
  };

  // 监听路由变化
  useEffect(() => {
    startLoading();

    // 模拟页面加载完成（实际项目中可以监听 router.events 或 window.load）
    // 这里用一个短延迟模拟，因为 Next.js App Router 的客户端导航很快
    const finishTimer = setTimeout(() => {
      finishLoading();
    }, 500);

    return () => {
      clearTimeout(finishTimer);
      clearTimers();
    };
  }, [pathname]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => clearTimers();
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      aria-hidden="true"
    >
      {/* 进度条背景 */}
      <div className="absolute inset-0 bg-transparent" />

      {/* 进度条主体 */}
      <div
        className="h-full bg-[hsl(var(--ring))] transition-all duration-200 ease-out relative"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transition: "width 0.2s ease-out, opacity 0.3s ease-in-out",
        }}
      >
        {/* 末端 glow 效果 */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[hsl(var(--ring))] to-transparent opacity-60"
          style={{ filter: "blur(2px)" }}
        />
        {/* 末端亮块 */}
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-[hsl(var(--ring))] opacity-80" />
      </div>
    </div>
  );
}

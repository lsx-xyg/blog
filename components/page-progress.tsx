"use client";

/**
 * 页面加载进度条组件
 *
 * 功能：
 * - 点击链接时立即在页面顶部显示加载进度条（提供即时反馈）
 * - 路由切换完成后进度到 100% 并隐藏
 * - 颜色跟随三色主题
 * - 末端带轻微 glow 效果
 * - 高度 2-3px，不占空间
 *
 * 实现方式：
 * - 全局监听链接点击事件，点击时立即显示进度条（0% -> 90%）
 * - 使用 usePathname 监听路由变化，路由变化后完成进度（90% -> 100% -> 隐藏）
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
  const isLoadingRef = useRef(false);

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
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
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
    if (!isLoadingRef.current) return;
    isLoadingRef.current = false;

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

  // 全局监听链接点击事件，点击时立即显示进度条
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 找到点击的链接元素
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;

      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // 只处理站内链接（相对路径或同域名）
      const isExternal =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#");

      if (isExternal) return;

      // 检查是否是新标签页打开（target="_blank" 或按住 cmd/ctrl）
      const isNewTab =
        link.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey;
      if (isNewTab) return;

      // 检查是否是下载链接
      if (link.hasAttribute("download")) return;

      // 检查是否和当前页面是同一个页面（去除 hash 和 query）
      const currentPath = window.location.pathname;
      const targetPath = href.split("#")[0].split("?")[0];
      if (currentPath === targetPath) {
        // 同一个页面，不触发进度条，直接返回
        return;
      }

      // 开始显示进度条
      startLoading();
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // 监听全局导航事件（router.push() 触发）
  useEffect(() => {
    const handleNavigationStart = () => startLoading();
    const handleNavigationEnd = () => finishLoading();

    window.addEventListener("navigationstart", handleNavigationStart);
    window.addEventListener("navigationend", handleNavigationEnd);

    return () => {
      window.removeEventListener("navigationstart", handleNavigationStart);
      window.removeEventListener("navigationend", handleNavigationEnd);
    };
  }, []);

  // 监听路由变化，路由变化后完成进度
  useEffect(() => {
    // 路由变化后，延迟一小段时间完成进度（让用户看到 100% 的状态）
    const finishTimer = setTimeout(() => {
      finishLoading();
    }, 200);

    return () => {
      clearTimeout(finishTimer);
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

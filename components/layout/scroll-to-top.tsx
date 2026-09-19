"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 通用滚动到顶部组件
 *
 * 解决页面加载时滚动位置不在顶部的问题：
 * - 图片懒加载导致页面高度变化，滚动位置被推到下方
 * - 客户端导航时没有正确重置滚动位置
 * - 其他客户端组件导致的滚动位置偏移
 *
 * 使用方式：
 * 在需要滚动到顶部的页面中添加 <ScrollToTop /> 即可
 *
 * 实现原理：
 * - 使用 useEffect 监听路径变化
 * - 使用 requestAnimationFrame 双重保险确保滚动到顶部
 * - 第一次 requestAnimationFrame：在浏览器重绘前滚动
 * - 第二次 requestAnimationFrame：在第一次滚动后再次确认，确保滚动生效
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // 第一次滚动：在浏览器重绘前滚动到顶部
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);

      // 第二次滚动：在第一次滚动后再次确认，确保滚动生效
      // 这是双重保险，避免某些情况下第一次滚动不生效
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    });
  }, [pathname]);

  return null;
}

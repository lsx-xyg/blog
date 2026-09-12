"use client";

import { useEffect, useState } from "react";
import Giscus from "@giscus/react";

/**
 * giscus 评论组件
 *
 * 基于 GitHub Discussions，零后端，与后台登录完全隔离
 * （iframe 内独立 OAuth App，互不影响）
 *
 * 配置通过环境变量注入：
 * - NEXT_PUBLIC_GISCUS_REPO: 仓库名（格式：owner/repo）
 * - NEXT_PUBLIC_GISCUS_REPO_ID: 仓库 ID（从 giscus.app 获取）
 * - NEXT_PUBLIC_GISCUS_CATEGORY: 讨论分类（默认 Announcements）
 * - NEXT_PUBLIC_GISCUS_CATEGORY_ID: 分类 ID（从 giscus.app 获取）
 *
 * 前置条件：
 * 1. 仓库必须公开
 * 2. 仓库已开启 Discussions
 * 3. 已安装 giscus GitHub App
 */
export function Comments() {
  const [theme, setTheme] = useState<string>("light");

  // 从 localStorage 读取当前主题（与 lib/theme.ts 的存储 key 一致）
  useEffect(() => {
    const storedTheme = localStorage.getItem("site-theme") || "light";
    setTheme(storedTheme);

    // 监听主题变化
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "site-theme") {
        setTheme(e.newValue || "light");
      }
    };
    window.addEventListener("storage", handleStorage);

    // 监听自定义主题切换事件
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem("site-theme") || "light";
      setTheme(currentTheme);
    };
    window.addEventListener("themechange", handleThemeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("themechange", handleThemeChange as EventListener);
    };
  }, []);

  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY || "Announcements";
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  // 未配置 giscus 时不渲染
  if (!repo || !repoId || !categoryId) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        评论系统未配置，请在环境变量中设置 giscus 相关参数。
      </div>
    );
  }

  // 根据当前主题切换 giscus 主题
  const giscusTheme =
    theme === "dark"
      ? "dark"
      : theme === "warm"
        ? "light"
        : theme === "system"
          ? "preferred_color_scheme"
          : "light";

  return (
    <div className="mt-12">
      <h2 className="mb-6 text-xl font-semibold">评论</h2>
      <Giscus
        id="comments"
        repo={repo as `${string}/${string}`}
        repoId={repoId}
        category={category}
        categoryId={categoryId}
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme={giscusTheme}
        lang="zh-CN"
        loading="lazy"
      />
    </div>
  );
}

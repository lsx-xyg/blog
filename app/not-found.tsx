"use client";

import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

/**
 * 自定义 404 页面
 *
 * 确保 404 页面跟其他页面一样，正确应用主题切换（浅色/深色/护眼/跟随系统）。
 * Next.js 默认的 404 页面可能没有正确应用主题变量，所以需要自定义。
 *
 * 主题切换机制：
 * - 主题初始化脚本在 app/layout.tsx 的 <head> 中通过内联 <script> 注入
 * - 主题通过在 <html> 元素上添加 dark 或 theme-warm class 来应用
 * - CSS 变量根据 <html> 元素的 class 来切换（:root / html.dark / html.theme-warm）
 * - 这个页面使用根布局（app/layout.tsx），所以主题初始化脚本能正常运行
 */
export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      {/* 404 大数字 */}
      <h1 className="text-8xl font-bold tracking-tight text-foreground md:text-9xl">
        404
      </h1>

      {/* 错误信息 */}
      <h2 className="mt-4 text-2xl font-semibold text-foreground md:text-3xl">
        页面不存在
      </h2>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        抱歉，您访问的页面不存在或已被移除。请检查网址是否正确，或返回首页继续浏览。
      </p>

      {/* 操作按钮 */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Home className="h-4 w-4" />
          返回首页
        </Link>
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          浏览相册
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上一页
        </button>
      </div>

      {/* 提示信息 */}
      <p className="mt-12 text-sm text-muted-foreground">
        如果您认为这是一个错误，请联系站长。
      </p>
    </div>
  );
}

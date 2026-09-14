/**
 * 后台面包屑导航组件
 *
 * 功能：
 * - 显示当前页面在后台的位置
 * - 点击首页可返回前台
 * - 点击后台管理可返回后台首页
 * - 支持自定义当前页面名称
 *
 * 用法：
 * <AdminBreadcrumb current="文章管理" />
 * <AdminBreadcrumb current="编辑文章" parent={{ label: "文章管理", href: "/dashboard/posts" }} />
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight, LayoutDashboard } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbProps {
  /** 当前页面名称 */
  current: string;
  /** 父级页面（可选），例如编辑文章的父级是文章管理 */
  parent?: BreadcrumbItem;
  /** 后台路径，默认从路径中自动提取 */
  adminPath?: string;
}

export function AdminBreadcrumb({ current, parent, adminPath }: AdminBreadcrumbProps) {
  const pathname = usePathname();

  // 从路径中自动提取后台路径（第一段）
  const extractedAdminPath = adminPath || pathname.split("/")[1] || "admin";

  // 页面加载时滚动到顶部，避免 Next.js 滚动恢复或组件加载导致的位置偏移
  useEffect(() => {
    // 使用 requestAnimationFrame 确保在浏览器渲染后执行
    const rafId = requestAnimationFrame(() => {
      // 先尝试 instant 滚动（现代浏览器支持），不支持则用 auto
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      } catch {
        window.scrollTo(0, 0);
      }
    });
    // 双重保险：在下一帧再滚动一次，确保数据加载后也能回到顶部
    const secondRafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(secondRafId);
    };
  }, [pathname]);

  return (
    <nav
      className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
      aria-label="面包屑"
    >
      {/* 首页 */}
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">首页</span>
      </Link>

      <ChevronRight className="h-3.5 w-3.5 shrink-0" />

      {/* 后台管理 */}
      <Link
        href={`/${extractedAdminPath}`}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">后台管理</span>
      </Link>

      {/* 父级页面（可选） */}
      {parent && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          {parent.href ? (
            <Link
              href={parent.href}
              className="hover:text-foreground transition-colors"
            >
              {parent.label}
            </Link>
          ) : (
            <span>{parent.label}</span>
          )}
        </>
      )}

      <ChevronRight className="h-3.5 w-3.5 shrink-0" />

      {/* 当前页面 */}
      <span className="text-foreground font-medium truncate">{current}</span>
    </nav>
  );
}

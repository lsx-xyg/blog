"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Image, User, Link2 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/gallery", label: "相册", icon: Image },
  { href: "/about", label: "关于", icon: User },
  { href: "/links", label: "友链", icon: Link2 },
];

/** 移动端底部固定导航栏（参考站 czhlove.cn 一比一还原）：
 * - fixed bottom，flex 布局，每项 flex-1
 * - 当前项 indigo-600 色 + 图标放大上移动画
 * - min-h-[44px] touch-manipulation（移动端可点击区域）
 * - 仅移动端显示（md:hidden）
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-2 text-xs transition-all duration-300 min-h-[44px] touch-manipulation ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`transition-transform duration-300 ${
                  isActive ? "scale-110 -translate-y-0.5" : ""
                }`}
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

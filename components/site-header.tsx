"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isAdminUser } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchDialog } from "@/components/search-dialog";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/album", label: "相册" },
  { href: "/about", label: "关于" },
  { href: "/links", label: "友链" },
];

/** 导航链接（参考站 czhlove.cn：底部 3px 下划线动画，当前页加粗+下划线满宽） */
function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center px-3 py-1 select-none transition-all duration-300 ease-in-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isActive
          ? "text-accent-foreground font-semibold text-[19px]"
          : "text-foreground font-medium text-[17px] hover:text-accent-foreground"
      }`}
    >
      <span className="relative z-10">{label}</span>
      <span
        className={`absolute left-0 -bottom-[6px] h-[3px] rounded-full transition-all duration-300 ease-in-out bg-primary ${
          isActive ? "w-full" : "w-0 group-hover:w-full"
        }`}
        aria-hidden="true"
      />
    </Link>
  );
}

/** 前台顶栏（参考站 czhlove.cn 一比一还原）：
 * - 桌面端：sticky header + logo（圆形头像+站名+副标题）+ nav 下划线动画 + 搜索/主题图标
 * - 移动端：仅 logo + 搜索/主题图标，底部固定导航由 MobileNav 组件负责
 */
export function SiteHeader({ adminPath }: { adminPath: string }) {
  const { data: session } = authClient.useSession();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  // 滚动隐藏/显示：向下滚动隐藏，向上滚动显示
  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ease-in-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3" aria-label="返回首页">
          <span className="relative flex shrink-0 overflow-hidden rounded-full h-12 w-12">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-xl font-bold">
              林
            </span>
          </span>
          <div className="hidden sm:block">
            <span className="block text-xl font-bold">林圣轩blog</span>
            <p className="text-sm text-muted-foreground">技术写作与生活记录</p>
          </div>
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center space-x-8">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          <SearchDialog />
          <ThemeToggle />
          {isAdminUser(session?.user as { isAdmin?: boolean } | undefined) && (
            <Link
              href={`/${adminPath}`}
              className="hidden md:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              后台
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

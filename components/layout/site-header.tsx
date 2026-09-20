"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { isAdminUser } from "@/lib/shared/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SearchDialog } from "@/components/shared/search-dialog";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/gallery", label: "相册" },
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
export function SiteHeader({
  adminPath,
  siteName,
  siteDescription,
}: {
  adminPath: string;
  siteName: string;
  siteDescription: string;
}) {
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
      // 隐藏/显示动画用内联 style 控制 transform/opacity/transition，确保浏览器一定过渡
      style={{
        transition: "transform 0.5s ease-in-out, opacity 0.5s ease-in-out",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        opacity: hidden ? 0 : 1,
        willChange: "transform",
      }}
      className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${
        hidden ? "shadow-none" : "shadow-sm"
      }`}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 py-2 px-1 -ml-1 rounded-lg hover:bg-accent/50 transition-colors active:bg-accent" aria-label="返回首页">
          <span className="relative flex shrink-0 overflow-hidden rounded-full h-12 w-12">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-xl font-bold">
              林
            </span>
          </span>
          <div className="hidden sm:block">
            <span className="block text-xl font-bold">{siteName}</span>
            <p className="text-sm text-muted-foreground">{siteDescription}</p>
          </div>
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center space-x-8">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* 右侧操作区（min-w 预留空间避免 session 加载后抖动） */}
        <div className="flex items-center gap-1 min-w-[160px] justify-end">
          <SearchDialog />
          <ThemeToggle />
          {isAdminUser(session?.user as { isAdmin?: boolean } | undefined) && (
            <div className="group relative">
              <Link
                href={`/${adminPath}`}
                className="h-[50px] w-[50px] rounded-full hover:bg-accent flex items-center justify-center transition-colors"
                aria-label="后台管理"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 z-50">
                后台
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isAdminUser } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchDialog } from "@/components/search-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/album", label: "相册" },
  { href: "/about", label: "关于" },
  { href: "/links", label: "友链" },
];

/** 导航链接（参考站 czhlove.cn：底部 3px 下划线动画，当前页加粗+下划线满宽） */
function NavLink({ href, label, mobile = false }: { href: string; label: string; mobile?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  if (mobile) {
    return (
      <Link
        href={href}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive
            ? "bg-accent text-accent-foreground font-semibold"
            : "text-foreground hover:bg-accent/50"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center px-3 py-1 select-none transition-all duration-300 ease-in-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isActive
          ? "text-accent-foreground font-semibold text-[18px]"
          : "text-foreground font-medium text-[16px] hover:text-accent-foreground"
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
 * - 桌面端：sticky header + logo（圆形头像+站名+副标题）+ nav 下划线动画 + 主题切换
 * - 移动端：汉堡菜单 + Sheet 侧边栏 + 底部固定导航（MobileNav 组件）
 */
export function SiteHeader({ adminPath }: { adminPath: string }) {
  const { data: session } = authClient.useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3" aria-label="返回首页">
          <span className="relative flex shrink-0 overflow-hidden rounded-full h-10 w-10">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-lg font-bold">
              林
            </span>
          </span>
          <div className="hidden sm:block">
            <span className="block text-lg font-bold">blog</span>
            <p className="text-xs text-muted-foreground">技术写作与生活记录</p>
          </div>
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center space-x-6">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1">
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

          {/* 移动端汉堡菜单 */}
          <Sheet>
            <SheetTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">菜单</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      林
                    </span>
                    blog
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-4">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} mobile />
                ))}
                {isAdminUser(session?.user as { isAdmin?: boolean } | undefined) && (
                  <NavLink href={`/${adminPath}`} label="后台" mobile />
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

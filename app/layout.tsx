import type { Metadata } from "next";
import "./globals.css";
import { getAdminPath } from "@/lib/admin-path";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "blog",
  description: "林圣轩的个人博客：技术写作与生活记录",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* 首屏防 FOUC：渲染前同步应用主题（localStorage + prefers-color-scheme） */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning：忽略浏览器扩展注入属性（如 data-atm-ext-installed）导致的水合差异 */}
      <body suppressHydrationWarning>
        <SiteHeader adminPath={getAdminPath()} />
        {children}
      </body>
    </html>
  );
}

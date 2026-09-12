import type { Metadata } from "next";
import "./globals.css";
import { getAdminPath } from "@/lib/admin-path";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";

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
        {/* LXGW WenKai Screen（霞鹜文楷屏显）：参考站 czhlove.cn 同款字体，unicode-range 子集化按需加载 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning：忽略浏览器扩展注入属性（如 data-atm-ext-installed）导致的水合差异 */}
      <body suppressHydrationWarning className="min-h-screen flex flex-col">
        <SiteHeader adminPath={getAdminPath()} />
        <main className="flex-1 pb-36 md:pb-0">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}

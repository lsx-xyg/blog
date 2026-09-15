import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import {
  THEME_INIT_SCRIPT,
  THEME_INIT_SCRIPT_SRC,
  THEME_KEY,
  getThemeClassFromValue,
} from "@/lib/shared/theme";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";
import { ToastProvider } from "@/components/toast";
import { PageProgress } from "@/components/page-progress";
import { getSiteSettings, getFooterSettings } from "../lib/settings";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 动态生成 metadata（从 settings 表读取站名和描述） */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: site.name,
      template: `%s | ${site.name}`,
    },
    description: site.seoDescription || site.description,
    keywords: [
      "博客",
      "技术博客",
      "Next.js",
      "React",
      "TypeScript",
      "全栈开发",
      "林圣轩",
    ],
    authors: [{ name: "林圣轩" }],
    creator: "林圣轩",
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: siteUrl,
      siteName: site.name,
      title: site.name,
      description: site.seoDescription || site.description,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description: site.seoDescription || site.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: siteUrl,
      types: {
        "application/rss+xml": `${siteUrl}/rss.xml`,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [site, footer, adminPath] = await Promise.all([
    getSiteSettings(),
    getFooterSettings(),
    getAdminPathAsync(),
  ]);

  // 服务端读取主题 cookie，直接在 <html> 上渲染主题 class：
  // 正常页面 SSR 时 html 已带正确 class（零 FOUC）；
  // 硬导航 404 等错误壳路径下，客户端接管时也会应用到 html，避免主题闪烁
  const cookieStore = await cookies();
  const themeClass = getThemeClassFromValue(cookieStore.get(THEME_KEY)?.value);

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={themeClass || undefined}
    >
      {/* 首屏防 FOUC：渲染前同步应用主题（localStorage + prefers-color-scheme） */}
      <head>
        {/* LXGW WenKai Screen（霞鹜文楷屏显）：参考站 czhlove.cn 同款字体
            优化：preload 提前加载 + 异步加载避免阻塞首屏渲染
            - preload：提前加载字体 CSS，提升加载速度
            - 内联 script 动态创建 link 元素，异步加载 CSS，不阻塞首屏渲染
            - noscript fallback：禁用 JS 时正常加载
        */}
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css"
        />
        {/* 异步加载字体 CSS：动态创建 link 元素，设置 media="print"，
            加载完成后把 media 改成 "all"，这样不会阻塞首屏渲染 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css';
                link.media = 'print';
                link.onload = function() {
                  link.media = 'all';
                };
                document.head.appendChild(link);
              })();
            `,
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css"
          />
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 外部文件兜底：硬导航 404 等错误壳路径下，head 内容由客户端动态插入，
            内联脚本不会执行，src 形式的脚本会被浏览器正常加载执行，保证主题一致 */}
        <script src={THEME_INIT_SCRIPT_SRC} async />
      </head>
      {/* suppressHydrationWarning：忽略浏览器扩展注入属性（如 data-atm-ext-installed）导致的水合差异 */}
      <body suppressHydrationWarning className="min-h-screen flex-col">
        <ToastProvider>
          <PageProgress />
          <SiteHeader
            adminPath={adminPath}
            siteName={site.name}
            siteDescription={site.description}
          />
          <main className="flex-1">{children}</main>
          <Footer
            siteName={site.name}
            copyright={footer.copyright}
            icp={footer.icp}
          />
          <MobileNav />
        </ToastProvider>
      </body>
    </html>
  );
}

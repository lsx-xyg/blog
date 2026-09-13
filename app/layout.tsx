import type { Metadata } from "next";
import "./globals.css";
import { getAdminPath } from "@/lib/admin-path";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";
import { ToastProvider } from "@/components/toast";
import { getSiteSettings, getFooterSettings } from "@/lib/settings";

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
  const [site, footer] = await Promise.all([
    getSiteSettings(),
    getFooterSettings(),
  ]);

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
      <body suppressHydrationWarning className="min-h-screen flex-col">
        <ToastProvider>
          <SiteHeader
            adminPath={getAdminPath()}
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

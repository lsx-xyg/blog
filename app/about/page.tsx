import { getAboutContent, getSiteSettings } from '@/lib/settings/server';
import { renderMdx } from '@/lib/mdx/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';
import type { Metadata } from 'next';

/** 动态生成关于页面 metadata */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const siteUrl = await getSiteUrlAsync();
  return {
    // 只写页面名：根布局模板会自动拼「| 站名」，手动再拼一次会得到
    // 「关于 | 林圣轩blog | 林圣轩blog」这种重复标题
    title: '关于本站与博主',
    description: `关于 ${site.name}：${site.description}。这里介绍博主的背景经历、博客的定位与内容方向。`,
    alternates: {
      canonical: `${siteUrl}/about`,
    },
  };
}

// ISR（增量静态再生）：每 300 秒（5分钟）重新生成一次页面
// 关于页内容更新不频繁，设置较长的 revalidate 时间
export const revalidate = 300;

export default async function AboutPage() {
  const [site, content] = await Promise.all([getSiteSettings(), getAboutContent()]);

  const { content: mdxContent } = await renderMdx(content);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl animate-page-enter">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">关于</h1>
        <p className="mt-3 text-muted-foreground">{site.name}</p>
      </header>

      {/* 正文样式与文章详情页共用 .mdx-content（globals.css）：
          prose 不可用 —— 项目未安装 @tailwindcss/typography，prose 是无样式的空类 */}
      <article className="mdx-content">{mdxContent}</article>
    </div>
  );
}

import { getAboutContent, getSiteSettings } from '@/lib/settings/server';
import { renderMdx } from '@/lib/mdx/server';
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** 动态生成关于页面 metadata */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: `关于 | ${site.name}`,
    description: `关于 ${site.name}`,
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

      <article className="prose prose-neutral dark:prose-invert max-w-none">{mdxContent}</article>
    </div>
  );
}

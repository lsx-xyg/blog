import { NextResponse } from 'next/server';
import { listPublishedPostMeta } from '@/lib/posts/server';
import { getSiteSettings } from '@/lib/settings/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';

/**
 * llms.txt（GEO，https://llmstxt.org）
 *
 * 给 AI 答案引擎（ChatGPT Search / Perplexity / Claude 等）的站点入口文件：
 * 用纯 Markdown 描述站点是什么、有哪些内容。AI 爬虫（见 robots.ts 的放行名单）
 * 会结合 robots.txt 的提示抓取本文件，提高被引用的概率。
 *
 * 与 rss.xml 同构：从 DB 读站点设置 + 已发布文章元数据，动态生成。
 */
export async function GET() {
  const [site, siteUrl, posts] = await Promise.all([
    getSiteSettings(),
    getSiteUrlAsync(),
    listPublishedPostMeta(),
  ]);

  const description = site.seoDescription?.trim() || site.description;

  const lines = [
    `# ${site.name}`,
    '',
    `> ${description}`,
    '',
    `站点：${siteUrl}/`,
    `RSS：${siteUrl}/rss.xml`,
    `相册：${siteUrl}/gallery`,
    `关于：${siteUrl}/about`,
    `友链：${siteUrl}/links`,
    '',
    '## 文章',
    '',
    ...posts.map((post) => {
      const url = `${siteUrl}/posts/${post.slug || post.id}`;
      return `- [${post.title}](${url})${post.summary ? `：${post.summary}` : ''}`;
    }),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

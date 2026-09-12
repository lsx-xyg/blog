import { NextResponse } from "next/server";
import { listPublishedPostMeta } from "@/lib/posts";

/**
 * RSS 2.0 feed
 *
 * 输出最新 20 篇已发布文章的 RSS
 * 包含：标题、链接、描述、发布日期、作者
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "林圣轩blog";
  const siteDescription =
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION || "技术写作与生活记录";

  // 获取最新 20 篇已发布文章
  const posts = (await listPublishedPostMeta()).slice(0, 20);

  const items = posts
    .map((post) => {
      const url = `${baseUrl}/posts/${post.slug || post.id}`;
      const pubDate = new Date(
        post.publishedAt || post.createdAt,
      ).toUTCString();
      const description = post.summary || "";

      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName}</title>
    <link>${baseUrl}</link>
    <description>${siteDescription}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

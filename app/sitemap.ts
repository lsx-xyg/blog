import type { MetadataRoute } from 'next';
import { getAllPostsForSitemap } from '@/lib/posts/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';
import { listPublicVideosWithPoster } from '@/lib/videos/server/public';

/**
 * sitemap.xml
 *
 * 包含：
 * - 首页
 * - 所有已发布文章详情页
 * - 所有已发布公开视频（/videos 与 /videos/[id]）
 * - 静态页面（关于、友链、相册、视频）
 *
 * 每次构建时自动生成，也可以在运行时动态生成。
 *
 * 视频收录说明：当前全量收录（仅 PUBLISHED + PUBLIC）。若以后视频量
 * 持续增大，可改为分批或只收录最近 N 条（见 Phase 4 计划，未实施）。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // getSiteUrlAsync 内置 fallback 链（NEXT_PUBLIC_SITE_URL > DB 站点设置 >
  // VERCEL_PROJECT_PRODUCTION_URL > localhost），保证输出绝对 URL
  const baseUrl = await getSiteUrlAsync();

  // 获取所有已发布文章
  const posts = await getAllPostsForSitemap();

  // 已发布公开视频（全量；listPublicVideosWithPoster 只含 PUBLISHED + PUBLIC）
  const videos = await listPublicVideosWithPoster({ limit: 1000 });

  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      // 友链页的实际路由是 /links（app/links/page.tsx，导航 NAV_ITEMS 同此）
      url: `${baseUrl}/links`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/videos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // 文章页面
  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug || post.id}`,
    lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  // 视频详情页（全量；lastModified 用 publishedAt，缺失回退构建时间）
  const videoPages: MetadataRoute.Sitemap = videos.map((video) => ({
    url: `${baseUrl}/videos/${video.id}`,
    lastModified: video.publishedAt ? new Date(video.publishedAt) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticPages, ...postPages, ...videoPages];
}

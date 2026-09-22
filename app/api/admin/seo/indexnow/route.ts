import { NextResponse } from 'next/server';
import { requireAdmin, adminDenied } from '@/lib/auth/server';
import { getAllPostsForSitemap } from '@/lib/posts/server';
import { getSeoSettings } from '@/lib/settings/server';
import { getSiteUrlAsync } from '@/lib/seo/shared';
import { isValidIndexNowKey, submitUrlsToIndexNow } from '@/lib/seo/server';

export const dynamic = 'force-dynamic';

/**
 * 后台：IndexNow 搜索收录管理（手动触发入口，替代去 Bing 官网提交）。
 *
 * - GET：当前状态（开关/密钥/密钥文件地址/可推送 URL 数）
 * - POST：一键推送全站 URL（首页 + 静态页 + 全部已发布文章）到 IndexNow，
 *         一次提交 Bing / Yandex / Seznam / Naver 共享通知
 */

/** 组装全站可推送 URL：静态页 + 全部已发布文章 */
async function buildAllIndexNowUrls(): Promise<string[]> {
  const siteUrl = await getSiteUrlAsync();
  const [posts] = await Promise.all([getAllPostsForSitemap()]);

  const staticUrls = [
    `${siteUrl}/`,
    `${siteUrl}/about`,
    `${siteUrl}/links`,
    `${siteUrl}/gallery`,
    `${siteUrl}/rss.xml`,
  ];
  const postUrls = posts.map((p) => `${siteUrl}/posts/${p.slug || p.id}`);
  return [...staticUrls, ...postUrls];
}

/** GET：状态信息（密钥是公开值——引擎本来就要抓它做校验，可直接返回） */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const [seo, siteUrl] = await Promise.all([getSeoSettings(), getSiteUrlAsync()]);
  const urls = await buildAllIndexNowUrls();

  return NextResponse.json({
    enabled: seo.indexNowEnabled,
    key: seo.indexNowKey,
    keyValid: isValidIndexNowKey(seo.indexNowKey),
    keyFileUrl: seo.indexNowKey ? `${siteUrl}/${seo.indexNowKey}.txt` : '',
    siteUrl,
    urlCount: urls.length,
    /** Google 不参与 IndexNow（其 Indexing API 仅限招聘/直播页），此处仅作前端展示说明 */
    googleNote:
      'Google 不支持 IndexNow：Google 侧靠 sitemap（/sitemap.xml 已就绪）+ Search Console 覆盖。',
  });
}

/** POST：一键推送全站 URL */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const urls = await buildAllIndexNowUrls();
  const result = await submitUrlsToIndexNow(urls);

  return NextResponse.json({
    ...result,
    urlCount: urls.length,
    timestamp: new Date().toISOString(),
  });
}

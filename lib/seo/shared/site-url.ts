/**
 * 站点根地址解析（SEO 三件套 robots/sitemap/rss 与 metadataBase 共用）
 *
 * 优先级（复用 settings 的唯一合并点 getConfig）：
 * 1. site.siteUrl：env NEXT_PUBLIC_SITE_URL > DB 后台「站点设置」> 默认空
 * 2. VERCEL_PROJECT_PRODUCTION_URL —— Vercel 自动注入的 *.vercel.app 域名，
 *    兜底防止 robots.txt / sitemap.xml 在线上输出 http://localhost:3000
 * 3. http://localhost:3000 —— 本地开发
 *
 * normalizeSiteUrl() 为纯函数（可单测）：去空白与结尾斜杠，无协议时补 https://。
 * DB 读取失败（如构建期网络抖动）静默降级到兜底，不阻断构建。
 */
import { getConfig } from '@/lib/settings/server';

export function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function getSiteUrlAsync(): Promise<string> {
  try {
    const configured = await getConfig('site.siteUrl');
    if (configured) return normalizeSiteUrl(String(configured));
  } catch {
    // DB 不可用时降级到环境兜底
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return normalizeSiteUrl(vercel);

  return 'http://localhost:3000';
}

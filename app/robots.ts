import type { MetadataRoute } from 'next';
import { getSiteUrlAsync } from '@/lib/seo/shared';

/**
 * robots.txt
 *
 * 允许所有搜索引擎爬虫，指向 sitemap.xml。
 *
 * Disallow 说明：
 * - /api/：接口不收录
 * - /admin：仅覆盖默认后台路径（兜底 adminSlug 的引导/登录页）。
 *   自定义后台路径（admin.path）**故意不写**进 robots.txt——robots.txt 公开可见，
 *   写了等于泄露后台入口；自定义路径由 [adminSlug]/layout.tsx 的 noindex metadata 保护。
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin'],
      },
    ],
    sitemap: `${await getSiteUrlAsync()}/sitemap.xml`,
  };
}

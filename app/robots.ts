import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * 允许所有搜索引擎爬虫
 * 指向 sitemap.xml
 * 禁止爬取后台路径（动态路径，用通配符）
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

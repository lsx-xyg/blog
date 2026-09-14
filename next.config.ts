import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * HTTP 缓存头配置
   *
   * 解决部署新版本后浏览器缓存导致的新旧版本资源不匹配问题：
   * - HTML 页面：不缓存，确保用户总是能拿到最新的 HTML（引用最新的 JS/CSS）
   * - 带哈希的静态资源（/_next/static/*）：长期缓存 1 年，因为文件名带哈希，内容变了文件名也会变
   * - 图片资源：缓存 1 天
   * - API 路由：不缓存
   *
   * 参考：https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
   */
  async headers() {
    return [
      {
        // HTML 页面：不缓存，确保用户总是能拿到最新的 HTML
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // 带哈希的静态资源（JS/CSS/字体等）：长期缓存 1 年，immutable
        // 因为文件名带哈希，内容变了文件名也会变，所以可以安全地长期缓存
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // 图片资源：缓存 1 天
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        // API 路由：不缓存
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // 生成 ETag，帮助浏览器判断资源是否变化
  generateEtags: true,

  // 移除 X-Powered-By 响应头，减少信息泄露
  poweredByHeader: false,
};

export default nextConfig;

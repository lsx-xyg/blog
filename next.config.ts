import type { NextConfig } from "next";

/**
 * 部署 ID（deploymentId）
 *
 * 用于开启版本偏移保护（Skew Protection），解决在线用户在版本更新时客户端崩溃的问题：
 * 1. 给静态资源打标签：Next.js 会在静态资源的 URL 后加上 ?dpl=<id>
 * 2. 客户端自动检测：页面跳转时带上 x-deployment-id，如果和服务器不匹配，强制完整刷新（Hard Reload）
 *
 * 优先级：
 * 1. VERCEL_DEPLOYMENT_ID - Vercel 自动注入，每次部署唯一（推荐）
 * 2. VERCEL_GIT_COMMIT_SHA - Git 提交 SHA，作为兜底
 * 3. dev - 本地开发环境默认值
 *
 * 注意：deploymentId 必须每次部署唯一，否则检测不到版本变化。
 * 参考：https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
 */
const deploymentId =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // 启用版本偏移保护（Skew Protection）
  // 解决在线用户在版本更新时，旧 JS 请求新服务器导致客户端崩溃的问题
  deploymentId,

  /**
   * HTTP 缓存头配置
   *
   * 解决部署新版本后浏览器缓存导致的新旧版本资源不匹配问题：
   * - HTML 页面：不缓存，确保用户总是能拿到最新的 HTML（引用最新的 JS/CSS）
   * - 带哈希的静态资源（/_next/static/*）：长期缓存 1 年，因为文件名带哈希，内容变了文件名也会变
   * - 图片资源：缓存 1 天
   * - API 路由：不缓存
   *
   * Cache-Control 和 deploymentId 是互补的：
   * - Cache-Control 防止"存储错资源"（新用户拿到新资源）
   * - deploymentId 防止"用错资源"（在线用户版本更新时自动强制刷新）
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

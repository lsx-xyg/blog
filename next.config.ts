import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

/**
 * Bundle Analyzer 配置
 *
 * 使用 @next/bundle-analyzer 分析打包体积，找出大体积的依赖和页面。
 *
 * 使用方式：
 * - 设置环境变量 ANALYZE=true，然后运行 npm run build
 * - 或者运行 npm run analyze（已在 package.json 中配置）
 *
 * 分析结果会生成在 .next/analyze/ 目录下，包含：
 * - client.html：客户端打包体积分析
 * - server.html：服务端打包体积分析
 *
 * 参考：https://www.npmjs.com/package/@next/bundle-analyzer
 */
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

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
const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // 启用版本偏移保护（Skew Protection）
  // 解决在线用户在版本更新时，旧 JS 请求新服务器导致客户端崩溃的问题
  deploymentId,

  /**
   * 实验性功能配置
   */
  experimental: {
    /**
     * optimizePackageImports - 优化大型库的导入
     *
     * 自动将全量导入转换为按需导入，减少打包体积。
     * 适用于那些没有提供 ES Module 按需导入的大型库。
     *
     * 优化的库：
     * - lucide-react：图标库，全量导入体积很大（约 1MB+）
     * - date-fns：日期处理库（如果使用）
     * - lodash：工具库（如果使用）
     *
     * 参考：https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports
     */
    optimizePackageImports: ['lucide-react'],
  },

  /**
   * 图片优化配置
   *
   * 使用 Next.js Image 组件自动优化图片：
   * - 自动转换为 WebP/AVIF 格式，减少体积
   * - 自动调整尺寸，根据设备屏幕大小加载合适的图片
   * - 懒加载，只加载视口内的图片
   * - 占位符，图片加载前显示模糊占位
   *
   * 远程图片域名配置：
   * - raw.githubusercontent.com：GitHub 图床
   * - cdn.jsdelivr.net：jsDelivr CDN（GitHub 图床加速）
   * - 其他 S3 兼容存储域名可以后续添加
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '**',
      },
    ],
    // 支持的图片格式，优先 AVIF，然后 WebP
    formats: ['image/avif', 'image/webp'],
    // 设备尺寸，用于生成响应式图片
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸，用于生成固定尺寸的图片
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

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
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // 带哈希的静态资源（JS/CSS/字体等）：长期缓存 1 年，immutable
        // 因为文件名带哈希，内容变了文件名也会变，所以可以安全地长期缓存
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 图片资源：缓存 1 天
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        // API 路由：不缓存
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
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

// 使用 bundleAnalyzer 包装 nextConfig
// 当 ANALYZE=true 时，会生成打包体积分析报告
export default bundleAnalyzer(nextConfig);

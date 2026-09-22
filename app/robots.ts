import type { MetadataRoute } from 'next';
import { getSiteUrlAsync } from '@/lib/seo/shared';

/** 显式放行的 AI 答案引擎爬虫（GEO：让 ChatGPT Search / Perplexity / Claude 等可引用站点内容） */
const AI_CRAWLERS = [
  'GPTBot', // OpenAI 训练
  'OAI-SearchBot', // ChatGPT Search 检索
  'ChatGPT-User', // ChatGPT 实时浏览
  'ClaudeBot', // Anthropic 训练
  'Claude-SearchBot', // Claude 检索
  'Claude-Web', // Claude 实时浏览
  'anthropic-ai',
  'PerplexityBot', // Perplexity 索引
  'Perplexity-User', // Perplexity 实时浏览
  'Google-Extended', // Google AI 训练（Gemini）
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl（多数 AI 训练数据的上游）
  'Bytespider', // 字节系（豆包）
  'Amazonbot',
  'meta-externalagent', // Meta AI
  'cohere-ai',
];

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
      {
        // GEO：显式放行 AI 爬虫（规则上与 * 等效，但显式声明意图，
        // 避免未来收紧 * 规则时误伤 AI 引擎收录）
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: ['/api/', '/admin'],
      },
    ],
    sitemap: `${await getSiteUrlAsync()}/sitemap.xml`,
  };
}

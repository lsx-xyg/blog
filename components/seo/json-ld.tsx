/**
 * JSON-LD 结构化数据组件（SEO/GEO）。
 *
 * 输出 <script type="application/ld+json">，供搜索引擎（Bing/Google 富摘要）
 * 与 AI 答案引擎（GEO：ChatGPT Search / Perplexity / Claude 引用）理解页面实体。
 *
 * 安全：JSON.stringify 后转义 <，防止正文内容提前闭合 script 标签（XSS）。
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

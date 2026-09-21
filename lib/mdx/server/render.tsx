/**
 * MDX 渲染（SPEC §2：next-mdx-remote-client + Shiki）
 * - 代码高亮：github-dark（深色代码块在三主题下对比度稳定）
 * - rehype-slug 为标题生成锚点 id
 * - TOC：remark-flexible-toc 自动提取目录，通过 vfileDataIntoScope 注入 scope
 * - 图片懒加载：使用自定义 LazyImage 组件
 * - Shiki 优化：使用 lazy 选项按需加载语言和主题
 */
import { evaluate, type EvaluateOptions } from 'next-mdx-remote-client/rsc';
import remarkFlexibleToc, { type TocItem } from 'remark-flexible-toc';
import rehypeShiki from '@shikijs/rehype';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { LazyImage } from '@/components/media/lazy-image';

// 自定义 MDX 组件
const components = {
  // 自定义 img 组件：正文图片宽高未知，用 natural 模式按图片自身比例整宽显示
  // （旧写法不传尺寸会走 fill 模式，而外层容器没有高度 → 图片塌陷不可见）
  img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // MDX 的 src 可能是 string 或 Blob，只处理 string 类型
    if (!src || typeof src !== 'string') return null;
    return (
      <LazyImage
        src={src}
        alt={alt || ''}
        mode="natural"
        sizes="(max-width: 768px) 100vw, 768px"
        className="my-6 rounded-lg"
      />
    );
  },
};

type Scope = {
  toc?: TocItem[];
};

/**
 * 进程内渲染缓存：key 为文章原文
 *
 * evaluate 是运行时全量编译（MDX AST + Shiki 高亮），长文可能耗时数百毫秒到秒级；
 * ISR 过期/冷启动后的首次访问都要重付这笔代价。缓存命中直接复用已渲染的
 * React 元素与 TOC，重复内容零开销。上限 50 篇（按插入顺序淘汰，博客场景足够）。
 */
const MDX_CACHE_LIMIT = 50;
const mdxCache = new Map<string, { content: React.ReactElement; toc: TocItem[] }>();

export async function renderMdx(source: string) {
  const cached = mdxCache.get(source);
  if (cached) {
    // 重新插入以实现简易 LRU（Map 保持插入序，delete+set 移到末尾）
    mdxCache.delete(source);
    mdxCache.set(source, cached);
    return cached;
  }

  const options: EvaluateOptions<Scope> = {
    mdxOptions: {
      remarkPlugins: [remarkGfm, remarkFlexibleToc],
      rehypePlugins: [[rehypeShiki, { theme: 'github-dark', lazy: true }], rehypeSlug],
    },
    vfileDataIntoScope: 'toc',
  };

  const { content, scope, error } = await evaluate<Record<string, unknown>, Scope>({
    source,
    options,
    components,
  });

  if (error) {
    return { content: <div>内容加载失败</div>, toc: [] };
  }

  const result = { content, toc: scope.toc ?? [] };
  mdxCache.set(source, result);
  if (mdxCache.size > MDX_CACHE_LIMIT) {
    // 淘汰最早的条目
    const oldest = mdxCache.keys().next().value;
    if (oldest !== undefined) mdxCache.delete(oldest);
  }
  return result;
}

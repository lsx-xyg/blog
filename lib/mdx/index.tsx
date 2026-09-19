/**
 * MDX 渲染（SPEC §2：next-mdx-remote-client + Shiki）
 * - 代码高亮：github-dark（深色代码块在三主题下对比度稳定）
 * - rehype-slug 为标题生成锚点 id
 * - TOC：remark-flexible-toc 自动提取目录，通过 vfileDataIntoScope 注入 scope
 * - 图片懒加载：使用自定义 LazyImage 组件
 * - Shiki 优化：使用 lazy 选项按需加载语言和主题
 */
import { evaluate, type EvaluateOptions } from "next-mdx-remote-client/rsc";
import remarkFlexibleToc, { type TocItem } from "remark-flexible-toc";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { LazyImage } from "@/components/media/lazy-image";

// 自定义 MDX 组件
const components = {
  // 自定义 img 组件，使用 LazyImage 实现懒加载
  img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // MDX 的 src 可能是 string 或 Blob，只处理 string 类型
    if (!src || typeof src !== "string") return null;
    return (
      <LazyImage
        src={src}
        alt={alt || ""}
        className="my-6 rounded-lg"
      />
    );
  },
};

type Scope = {
  toc?: TocItem[];
};

export async function renderMdx(source: string) {
  const options: EvaluateOptions<Scope> = {
    mdxOptions: {
      remarkPlugins: [remarkGfm, remarkFlexibleToc],
      rehypePlugins: [
        [rehypeShiki, { theme: "github-dark", lazy: true }],
        rehypeSlug,
      ],
    },
    vfileDataIntoScope: "toc",
  };

  const { content, scope, error } = await evaluate<
    Record<string, unknown>,
    Scope
  >({
    source,
    options,
    components,
  });

  if (error) {
    return { content: <div>内容加载失败</div>, toc: [] };
  }

  return { content, toc: scope.toc ?? [] };
}

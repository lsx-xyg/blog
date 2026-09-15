/**
 * MDX 渲染（SPEC §2：next-mdx-remote-client + Shiki）
 * - 代码高亮：github-dark（深色代码块在三主题下对比度稳定；T7 可做双主题适配）
 * - rehype-slug 为标题生成锚点 id
 * - 图片懒加载：使用自定义 LazyImage 组件（占位符 + 淡入动画 + Intersection Observer）
 * - Shiki 优化：使用 lazy 选项按需加载语言和主题，减少首屏体积
 */
import { MDXRemote } from "next-mdx-remote-client/rsc";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import { LazyImage } from "@/components/lazy-image";

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

export function renderMdx(source: string) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        mdxOptions: {
          rehypePlugins: [
            // Shiki 代码高亮
            // 使用 lazy 选项按需加载语言和主题，减少首屏体积
            // 主题：github-dark（深色代码块在三主题下对比度稳定）
            [rehypeShiki, { theme: "github-dark", lazy: true }],
            rehypeSlug,
          ],
        },
      }}
    />
  );
}

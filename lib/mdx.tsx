/**
 * MDX 渲染（SPEC §2：next-mdx-remote-client + Shiki）
 * - 代码高亮：github-dark（深色代码块在三主题下对比度稳定；T7 可做双主题适配）
 * - rehype-slug 为标题生成锚点 id
 */
import { MDXRemote } from "next-mdx-remote-client/rsc";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";

export function renderMdx(source: string) {
  return (
    <MDXRemote
      source={source}
      options={{
        mdxOptions: {
          rehypePlugins: [[rehypeShiki, { theme: "github-dark" }], rehypeSlug],
        },
      }}
    />
  );
}

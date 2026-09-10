import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPostBySlugOrId, listPublishedPosts } from "@/lib/posts";
import { renderMdx } from "@/lib/mdx";
import { formatDate } from "@/lib/utils";
import { CodeCopy } from "@/components/code-copy";
import { ViewCounter } from "@/components/view-counter";

export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await listPublishedPosts();
  return posts.map((p) => ({ slug: p.slug ?? p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlugOrId(slug);
  if (!post) return { title: "文章不存在" };
  return {
    title: post.title,
    description: post.summary ?? undefined,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPostBySlugOrId(slug);
  if (!post) notFound();

  // 阅读时长估算：中文约 500 字/分钟（markdown 原文含语法，取整保护最小 1 分钟）
  const readingMinutes = Math.max(1, Math.round(post.content.length / 500));

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold leading-snug md:text-[28px]">
          {post.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-fg-muted">
          <time dateTime={post.publishedAt?.toISOString()}>
            {formatDate(post.publishedAt ?? post.createdAt)}
          </time>
          <span>·</span>
          <span>{readingMinutes} 分钟阅读</span>
          <span>·</span>
          <ViewCounter initial={post.viewCount} slugOrId={post.slug ?? post.id} />
        </div>
      </header>

      <div className="mdx-content">{renderMdx(post.content)}</div>
      <CodeCopy />
    </article>
  );
}

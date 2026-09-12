import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPostBySlugOrId, listPublishedPosts } from "@/lib/posts";
import { renderMdx } from "@/lib/mdx";
import { formatDate } from "@/lib/utils";
import { extractToc } from "@/lib/toc";
import { CodeCopy } from "@/components/code-copy";
import { ViewCounter } from "@/components/view-counter";
import { ArticleToc } from "@/components/article-toc";
import { ArticleFloatButtons } from "@/components/article-float-buttons";
import { Comments } from "@/components/comments";
import { CalendarDays, Clock } from "lucide-react";

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${siteUrl}/posts/${post.slug || post.id}`;

  return {
    title: post.title,
    description: post.summary ?? undefined,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      locale: "zh_CN",
      url,
      title: post.title,
      description: post.summary ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      authors: ["林圣轩"],
      images: post.coverUrl
        ? [
            {
              url: post.coverUrl,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary ?? undefined,
      images: post.coverUrl ? [post.coverUrl] : undefined,
    },
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

  // 从 markdown 提取目录
  const tocItems = extractToc(post.content);

  return (
    <main className="container mx-auto px-2 py-4 md:px-4 md:py-8">
      <div className="w-full">
        <div className="mx-auto grid w-full grid-cols-1 max-w-4xl">
          <div className="min-w-0">
            <article className="mx-auto w-full max-w-4xl animate-page-enter">
              {/* 封面图 */}
              {post.coverUrl ? (
                <div className="mb-4 md:mb-8">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className="absolute h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  </div>
                </div>
              ) : null}

              {/* 标题 + 元信息 */}
              <div className="mb-4 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight text-foreground">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  <time
                    dateTime={post.publishedAt?.toISOString()}
                    className="flex items-center space-x-1.5"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                  </time>
                  <span className="flex items-center space-x-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{readingMinutes} 分钟阅读</span>
                  </span>
                  <ViewCounter initial={post.viewCount} slugOrId={post.slug ?? post.id} />
                </div>
              </div>

              {/* 正文内容 */}
              <div className="mdx-content">{renderMdx(post.content)}</div>
              <CodeCopy />

              {/* giscus 评论 */}
              <Comments />
            </article>
          </div>
        </div>
      </div>

      {/* 目录（PC端右侧固定，移动端弹出） */}
      <ArticleToc items={tocItems} />

      {/* 悬浮按钮（回顶部 + 关闭） */}
      <ArticleFloatButtons />
    </main>
  );
}

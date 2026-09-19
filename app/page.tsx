import { Suspense } from "react";
import dynamic from "next/dynamic";
import { listPublishedPosts, listPublishedPostMeta } from "@/lib/posts";
import { FileText, Tags, Star } from "lucide-react";
import { getSiteSettings } from "../lib/settings";
import type { Metadata } from "next";

// PostWall 组件代码分割（包含 minisearch，体积较大）
// ssr: true - 保持服务端渲染，不影响首屏内容和 SEO
// 打包成单独的 chunk，不影响首屏的其他代码加载
const PostWall = dynamic(
  () => import("@/components/posts/post-wall").then((mod) => mod.PostWall),
  {
    ssr: true,
    loading: () => (
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="mb-6 h-48 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    ),
  },
);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 动态生成首页 metadata */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: site.name,
    description: site.seoDescription || site.description,
    alternates: {
      canonical: siteUrl,
    },
  };
}

// ISR（增量静态再生）：每 60 秒重新生成一次页面
// 平衡性能和实时性：发布新文章/更新站点设置后最多 60 秒生效
// PostWall 组件是客户端组件，挂载后会拉取全量元数据，文章列表实时更新
export const revalidate = 60;

const PAGE_SIZE = 9;

export default async function Home() {
  const site = await getSiteSettings();
  // 首屏 SSR 第一页（SEO），PostWall 挂载后拉全量元数据做筛选/搜索/分批渲染
  const initialPosts = await listPublishedPosts({ limit: PAGE_SIZE });
  // 统计数据：文章数/标签数/精选数
  const allMetas = await listPublishedPostMeta();
  const postCount = allMetas.length;
  const featuredCount = allMetas.filter((m) => m.featured).length;
  const tagCount = new Set(allMetas.flatMap((m) => m.tags)).size;

  return (
    <div className="container mx-auto px-4 py-16">
      {/* 居中 header：站名 + 简介 + 统计 */}
      <header className="mb-14 text-center animate-page-enter">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{site.name}</h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {site.description}
        </p>
        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="font-bold text-foreground">{postCount}</span> 篇文章
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Tags className="h-4 w-4" />
            <span className="font-bold text-foreground">{tagCount}</span> 个标签
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4" />
            <span className="font-bold text-foreground">{featuredCount}</span> 篇精选
          </span>
        </div>
      </header>

      {/* PostWall 使用了 useSearchParams()，需要包裹在 Suspense 边界中
          否则静态生成（ISR）时会报错：useSearchParams() should be wrapped in a suspense boundary */}
      <Suspense
        fallback={
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div
                key={i}
                className="mb-6 h-48 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        }
      >
        <PostWall initialPosts={initialPosts} pageSize={PAGE_SIZE} />
      </Suspense>
    </div>
  );
}

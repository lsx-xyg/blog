import { listPublishedPosts, listPublishedPostMeta } from "@/lib/posts";
import { PostWall } from "@/components/post-wall";
import { FileText, Tags, Star } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import type { Metadata } from "next";

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

// 实时渲染：博客低流量，发布/删除立即可见（T7 前台客户端拉取元数据）
export const dynamic = "force-dynamic";

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

      <PostWall initialPosts={initialPosts} pageSize={PAGE_SIZE} />
    </div>
  );
}

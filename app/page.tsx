import { listPublishedPosts } from "@/lib/posts";
import { PostWall } from "@/components/post-wall";

export const metadata = {
  title: "blog · 首页",
  description: "林圣轩的个人博客：技术写作与生活记录",
};

// 实时渲染：博客低流量，发布/删除立即可见（T7 前台客户端拉取元数据）
export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

export default async function Home() {
  // 首屏 SSR 第一页（SEO），PostWall 挂载后拉全量元数据做筛选/搜索/分批渲染
  const initialPosts = await listPublishedPosts({ limit: PAGE_SIZE });

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <p className="font-mono text-sm text-muted-foreground">
          blog · blog.dbthree.dpdns.org
        </p>
        <h1 className="mt-3 text-2xl font-bold">林圣轩的个人博客</h1>
        <p className="mt-2 text-muted-foreground">
          技术写作与生活记录
          {/* T2：简介将接入 settings.site_description */}
        </p>
      </header>

      <PostWall initialPosts={initialPosts} pageSize={PAGE_SIZE} />
    </div>
  );
}

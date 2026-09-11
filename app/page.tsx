import { listPublishedPosts } from "@/lib/posts";
import { PostWall } from "@/components/post-wall";

export const metadata = {
  title: "blog · 首页",
  description: "林圣轩的个人博客：技术写作与生活记录",
};

// 实时渲染：博客低流量，发布/删除立即可见（T7 前台改客户端拉取后演进）
export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

export default async function Home() {
  // 首屏 SSR 第一页，后续由 PostWall 滚动加载（瀑布流 + 增量）
  const initialPosts = await listPublishedPosts({ limit: PAGE_SIZE });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="font-mono text-sm text-fg-muted">
          blog · blog.dbthree.dpdns.org
        </p>
        <h1 className="mt-3 text-2xl font-semibold">林圣轩的个人博客</h1>
        <p className="mt-2 text-fg-muted">
          技术写作与生活记录
          {/* T2：简介将接入 settings.site_description */}
        </p>
      </header>

      {initialPosts.length === 0 ? (
        <section className="rounded-xl border border-border bg-surface p-12 text-center text-fg-muted">
          还没有已发布的文章，去后台写第一篇吧。
        </section>
      ) : (
        <PostWall initialPosts={initialPosts} pageSize={PAGE_SIZE} />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10">
        <p className="font-mono text-sm text-fg-muted">
          blog · blog.dbthree.dpdns.org
        </p>
        <h1 className="mt-3 text-2xl font-semibold">林圣轩的个人博客</h1>
        <p className="mt-2 text-fg-muted">技术写作与生活记录（M1 脚手架占位）</p>
      </header>
      <section className="rounded-xl border border-border bg-surface p-8 text-center text-fg-muted">
        M3 里程碑将在此实现：瀑布流文章列表 + 标签筛选 + 最新/精选切换
      </section>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MiniSearch from "minisearch";
import { PostCard } from "@/components/post-card";
import { PostToolbar } from "@/components/post-toolbar";
import type { Post } from "@/db/schema";

/**
 * minisearch 中文分词：默认 tokenizer 按空白/标点切分，整段中文会成为一个 token，
 * 导致中文关键词搜不到。改为：拉丁词按词，中文按单字 + 连续双字（bigram）索引。
 */
function cjkTokenize(text: string): string[] {
  const parts = text.toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const p of parts) {
    if (/[\u4e00-\u9fa5]/.test(p)) {
      for (let i = 0; i < p.length; i++) out.push(p[i]);
      for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i, i + 2));
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * 首页瀑布流 + 筛选（T7 方案 A 纯客户端）
 * - 启动拉取 /api/search-index 全量轻量元数据，前端负责：标签多选（AND）/ 精选 / minisearch 搜索 / 分批渲染
 * - CSS columns 瀑布流（卡片高度自适应），IntersectionObserver 每次 +pageSize 条
 * - URL 不变（筛选为前端 state，与参考站一致）；SEARCH_MODE=DATABASE 预留开关（服务端过滤走 /api/posts）
 */

/** search-index 返回的文章 JSON 形态（Date 序列化为 string） */
type SearchPost = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  featured: boolean;
  createdAt: string | null;
  publishedAt: string | null;
  tags: string[];
};

function toSearchPost(p: Post): SearchPost {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    coverUrl: p.coverUrl,
    featured: p.featured,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    tags: [],
  };
}

export function PostWall({
  initialPosts,
  pageSize,
}: {
  initialPosts: Post[];
  pageSize: number;
}) {
  // SSR 首屏数据（无标签）→ 拉全量后替换
  const [metas, setMetas] = useState<SearchPost[]>(() => initialPosts.map(toSearchPost));
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(Math.max(initialPosts.length, pageSize));
  const stateRef = useRef({ metasReady: false, loading: false });
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 拉取全量元数据（一次），替换 SSR 数据源
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/search-index");
        if (!r.ok) throw new Error("加载失败");
        const d = await r.json();
        if (!cancelled) {
          setMetas(d.posts?.length ? d.posts : metas);
          stateRef.current.metasReady = true;
        }
      } catch {
        /* 拉取失败保留 SSR 首屏，可滚动重试 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // minisearch 索引（全量数据就绪后重建）
  const mini = useRef<MiniSearch<SearchPost> | null>(null);
  useEffect(() => {
    if (!metas.length) return;
    const ms = new MiniSearch<SearchPost>({
      fields: ["title", "summary", "tags"],
      storeFields: ["id"],
      tokenize: cjkTokenize,
      searchOptions: { prefix: true, fuzzy: 0.2 },
    });
    ms.addAll(metas);
    mini.current = ms;
  }, [metas]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const toggleFeatured = useCallback(() => setOnlyFeatured((v) => !v), []);

  // 前端过滤：标签（AND 全命中）→ 精选 → minisearch 搜索
  const filtered = useMemo(() => {
    let list = metas;
    if (selectedTags.length) {
      list = list.filter((p) => selectedTags.every((t) => p.tags.includes(t)));
    }
    if (onlyFeatured) list = list.filter((p) => p.featured);
    const q = query.trim();
    if (q && mini.current) {
      const hits = new Set(mini.current.search(q).map((r) => r.id));
      list = list.filter((p) => hits.has(p.id));
    }
    return list;
  }, [metas, selectedTags, onlyFeatured, query]);

  // 全部标签（按出现顺序去重，供工具栏横排）
  const allTags = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of metas) {
      for (const t of p.tags) {
        if (!seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
    }
    return out;
  }, [metas]);

  const visibleItems = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (s.loading) return;
    s.loading = true;
    setLoading(true);
    // 下一帧渲染新批次，模拟增量加载（数据已在前端，无需网络）
    requestAnimationFrame(() => {
      setVisible((v) => v + pageSize);
      s.loading = false;
      setLoading(false);
    });
  }, [pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" }, // 提前 400px 预加载，滚动无感知
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  return (
    <section>
      <PostToolbar
        allTags={allTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        onlyFeatured={onlyFeatured}
        onToggleFeatured={toggleFeatured}
        query={query}
        onQueryChange={setQuery}
      />

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-fg-muted">
          {query || selectedTags.length || onlyFeatured
            ? "没有符合条件的文章，换个筛选试试。"
            : "还没有已发布的文章，去后台写第一篇吧。"}
        </div>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {visibleItems.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* 触底哨兵：还有更多时挂载，触发 IntersectionObserver */}
      {hasMore && <div ref={sentinelRef} aria-hidden />}

      {loading && (
        <p className="py-8 text-center font-mono text-xs text-fg-muted">
          加载中…
        </p>
      )}
      {!hasMore && filtered.length > 0 && (
        <p className="py-8 text-center font-mono text-xs text-fg-muted">
          · 已经到底啦 ·
        </p>
      )}
    </section>
  );
}

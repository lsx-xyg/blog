"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import type { Post } from "@/db/schema";

/**
 * 首页瀑布流（CSS columns，卡片高度自适应：摘要长短/有无封面自然错落）
 * + IntersectionObserver 滚动加载（增量拉取，不一次性全出）
 * T7 将在此基础上扩展标签筛选/搜索
 */
export function PostWall({
  initialPosts,
  pageSize,
}: {
  initialPosts: Post[];
  pageSize: number;
}) {
  const [items, setItems] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const stateRef = useRef({ page: 1, hasMore: initialPosts.length >= pageSize, loading: false });
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    const s = stateRef.current;
    if (s.loading || !s.hasMore) return;
    s.loading = true;
    setLoading(true);
    try {
      const next = s.page + 1;
      const r = await fetch(`/api/posts?page=${next}&pageSize=${pageSize}`);
      if (!r.ok) throw new Error("加载失败");
      const d = await r.json();
      setItems((prev) => [...prev, ...d.posts]);
      s.hasMore = d.hasMore;
      s.page = next;
    } catch {
      /* 网络异常时保持现状，滚动可重试 */
    } finally {
      s.loading = false;
      setLoading(false);
    }
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
  }, [loadMore]);

  return (
    <section>
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* 触底哨兵：还有更多时挂载，触发 IntersectionObserver */}
      {stateRef.current.hasMore && <div ref={sentinelRef} aria-hidden />}

      {loading && (
        <p className="py-8 text-center font-mono text-xs text-fg-muted">
          加载中…
        </p>
      )}
      {!stateRef.current.hasMore && items.length > 0 && (
        <p className="py-8 text-center font-mono text-xs text-fg-muted">
          · 已经到底啦 ·
        </p>
      )}
    </section>
  );
}

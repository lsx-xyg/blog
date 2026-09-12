"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryMeta } from "@/lib/gallery";
import { Filter, Sparkles, Clock, ChevronDown, ChevronUp } from "lucide-react";

/**
 * 相册瀑布流组件
 *
 * 功能：
 * - CSS columns 瀑布流（1/2/3/4 列响应式）
 * - IntersectionObserver 无限滚动（每次 +9 张）
 * - 标签 OR 筛选（多选，隐藏式筛选面板）
 * - 最新/精选切换
 * - 图片懒加载
 * - 点击图片查看大图（简单实现）
 */
export function GalleryWall() {
  const [items, setItems] = useState<GalleryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 拉取全量轻量元数据
  useEffect(() => {
    fetch("/api/search-index")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.gallery || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 所有标签（去重）
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => item.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [items]);

  // 筛选后的列表
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (onlyFeatured && !item.featured) return false;
      if (selectedTags.length > 0) {
        // OR 语义：命中任一标签即匹配
        const hasTag = selectedTags.some((t) => item.tags.includes(t));
        if (!hasTag) return false;
      }
      return true;
    });
  }, [items, onlyFeatured, selectedTags]);

  // 当前可见列表
  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // IntersectionObserver 无限滚动
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((c) => c + 9);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  // 筛选变化时重置可见数量
  useEffect(() => {
    setVisibleCount(9);
  }, [selectedTags, onlyFeatured]);

  // 切换标签
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 工具栏：标签筛选（隐藏式）+ 最新/精选切换 */}
      <div className="space-y-4">
        {/* 标签筛选按钮（隐藏式） */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowTagFilter(!showTagFilter)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <Filter className="h-4 w-4" />
            标签筛选
            {selectedTags.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {selectedTags.length}
              </span>
            )}
            {showTagFilter ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* 最新/精选切换 */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOnlyFeatured(false)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
                !onlyFeatured
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <Clock className="h-4 w-4" />
              最新
            </button>
            <button
              type="button"
              onClick={() => setOnlyFeatured(true)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
                onlyFeatured
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              精选
            </button>
          </div>
        </div>

        {/* 标签筛选面板（展开/收缩动画） */}
        <div
          className={`grid transition-all duration-300 ${
            showTagFilter ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
              {allTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无标签</p>
              ) : (
                allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {tag}
                  </button>
                ))
              )}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 瀑布流 */}
      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          {selectedTags.length || onlyFeatured
            ? "没有符合条件的图片，换个筛选试试。"
            : "还没有图片，去后台上传第一张吧。"}
        </div>
      ) : (
        <div
          key={`${onlyFeatured ? "featured" : "latest"}-${selectedTags.join(",")}`}
          className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 animate-fade-in-up"
        >
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="mb-4 break-inside-avoid cursor-pointer group"
              onClick={() => setPreviewImage(item.imageUrl)}
            >
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.title || "相册图片"}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto transition-transform duration-300 group-hover:scale-105"
                />
                {/* 悬浮信息 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {item.title && (
                      <p className="text-sm font-medium text-white">{item.title}</p>
                    )}
                    {item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* 精选标记 */}
                {item.featured && (
                  <div className="absolute top-2 right-2 rounded-full bg-primary/90 px-2 py-0.5 text-xs text-primary-foreground">
                    精选
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 触底哨兵 */}
      {hasMore && <div ref={sentinelRef} aria-hidden />}

      {loading && (
        <p className="py-8 text-center font-mono text-xs text-fg-muted">加载中…</p>
      )}
      {!hasMore && filtered.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">已经到底啦 ·</p>
      )}

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="预览"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

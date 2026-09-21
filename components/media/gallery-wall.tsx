'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LazyImage } from '@/components/media/lazy-image';
import type { GalleryMeta } from '@/lib/types/gallery';
import { Filter, Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';

/** 老数据没有宽高信息时的兜底占位比例（4:3，加载完成后按真实比例重排） */
const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT = 900;

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
  const pathname = usePathname();
  const [items, setItems] = useState<GalleryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 拉取全量轻量元数据
  // 依赖 pathname，确保路由变化时重新获取数据（避免 Next.js Router Cache 导致不刷新）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/search-index')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const gallery = data.gallery || [];
        console.log('[GalleryWall] 获取到相册数据:', gallery.length, '条');
        console.log('[GalleryWall] 完整响应:', data);
        setItems(gallery);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[GalleryWall] 获取数据失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
      { rootMargin: '200px' },
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

  // 错误状态显示
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
        <p className="text-lg font-medium text-destructive">加载失败</p>
        <p className="mt-2 text-sm text-destructive/80">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* 工具栏骨架 */}
        <div className="flex items-center justify-between">
          <div className="h-9 w-32 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-9 w-32 animate-pulse rounded-lg border border-border bg-card" />
        </div>

        {/* 瀑布流骨架（跟首页一致的卡片骨架） */}
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mb-4 break-inside-avoid">
              <div
                className={`animate-pulse rounded-lg border border-border bg-card ${
                  i % 3 === 0 ? 'h-64' : i % 3 === 1 ? 'h-48' : 'h-56'
                }`}
              />
            </div>
          ))}
        </div>
      </div>
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
                !onlyFeatured ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <Clock className="h-4 w-4" />
              最新
            </button>
            <button
              type="button"
              onClick={() => setOnlyFeatured(true)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
                onlyFeatured ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
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
            showTagFilter ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-4">
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
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
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
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {selectedTags.length || onlyFeatured
            ? '没有符合条件的图片，换个筛选试试。'
            : '还没有图片，去后台上传第一张吧。'}
        </div>
      ) : (
        <div
          key={`${onlyFeatured ? 'featured' : 'latest'}-${selectedTags.join(',')}`}
          className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 animate-fade-in-up"
        >
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="mb-4 break-inside-avoid cursor-pointer group"
              onClick={() => setPreviewImage(item.imageUrl)}
            >
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                {/* 使用 LazyImage 的 intrinsic 模式：上传时已用 sharp 探测原始宽高存进
                    media.width/height，按原始比例整宽渲染，瀑布流自然高度与 next/image
                    优化（WebP/AVIF、响应式尺寸）兼得。老数据宽高为 null 时退到默认比例。 */}
                <LazyImage
                  src={item.imageUrl}
                  alt={item.title || '相册图片'}
                  width={item.width ?? FALLBACK_WIDTH}
                  height={item.height ?? FALLBACK_HEIGHT}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  imgClassName="transition-transform duration-500 group-hover:scale-105"
                  onError={() => console.error('[GalleryWall] 图片加载失败:', item.imageUrl)}
                />
                {/* 悬浮信息 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {item.title && <p className="text-sm font-medium text-white">{item.title}</p>}
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
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">加载中…</p>
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
          <div
            className="relative h-full w-full"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Image
              src={previewImage}
              alt="预览"
              fill
              sizes="100vw"
              quality={90}
              className="object-contain"
            />
          </div>
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

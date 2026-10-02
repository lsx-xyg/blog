'use client';

/**
 * 前台视频瀑布流（Step C1）
 *
 * - CSS columns 实现（columns-2 md:columns-3 lg:columns-4），不引入 masonry 库
 * - 每张卡片只渲染封面图 + 标题 + 时长，不渲染 <video>（性能约束）
 * - 卡片高度按视频原始宽高比撑开，缺失统一回退 9:16（getAspectRatio 默认 portrait）
 * - 无限滚动：IntersectionObserver 触底拉取 /api/videos?cursor=
 * - 数据接口只回数据，布局组件独立（扩展点 8：切换布局不改接口）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clapperboard } from 'lucide-react';
import type { PublicVideoCard } from '@/lib/videos/server/public';
import { getAspectRatio, formatDuration } from '@/lib/videos/shared/video';

type Props = {
  initial: PublicVideoCard[];
  hasMore: boolean;
  pageSize?: number;
};

/** 封面尺寸策略：分列宽（列表小图；播放页大图在 [id] 页单独处理） */
const IMAGE_SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

export function VideoMasonry({ initial, hasMore: initialHasMore, pageSize = 12 }: Props) {
  const [items, setItems] = useState<PublicVideoCard[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/videos?cursor=${items.length}&limit=${pageSize}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        items: PublicVideoCard[];
        hasMore: boolean;
        nextCursor: number | null;
      };
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, items.length, pageSize]);

  // 触底加载（SSR 无 window 时不挂观察器）
  useEffect(() => {
    if (typeof window === 'undefined' || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Clapperboard className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">还没有视频</p>
        <p className="text-sm text-muted-foreground">主人还没有发布视频，过段时间再来看看吧</p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
      {items.map((v, i) => (
        <Link
          key={v.id}
          href={`/videos/${v.id}`}
          className="group mb-4 block break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg animate-fade-in-up"
          style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
        >
          {/* 封面：不渲染 <video>，按原始比例撑开（缺失 9/16） */}
          <div
            className="relative w-full overflow-hidden bg-muted"
            style={{ aspectRatio: getAspectRatio(v.width, v.height) }}
          >
            {v.posterUrl ? (
              <Image
                src={v.posterUrl}
                alt={v.title || '视频封面'}
                fill
                sizes={IMAGE_SIZES}
                loading="lazy"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Clapperboard className="h-8 w-8 text-muted-foreground/60" />
              </div>
            )}
            {v.durationSeconds != null ? (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-xs text-white">
                {formatDuration(v.durationSeconds)}
              </span>
            ) : null}
          </div>
          {/* 标题 */}
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">
              {v.title || '未命名视频'}
            </p>
          </div>
        </Link>
      ))}

      {/* 触底哨兵 */}
      <div ref={sentinelRef} className="col-span-full h-px" aria-hidden="true" />

      {loading ? (
        <div className="col-span-full mt-2 space-y-2">
          <div className="h-4 animate-pulse rounded bg-muted" />
        </div>
      ) : null}

      {error ? (
        <div className="col-span-full mt-4 text-center text-sm text-destructive">
          加载失败，
          <button
            type="button"
            className="underline underline-offset-2 hover:text-destructive/80"
            onClick={() => void loadMore()}
          >
            点击重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

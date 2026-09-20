import Link from 'next/link';
import { formatDate } from '@/lib/shared';
import { CalendarDays, Star } from 'lucide-react';
import { LazyImage } from '@/components/media/lazy-image';

/** 卡片所需字段（兼容 db Post 与 search-index JSON 两种来源） */
export type CardPost = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  publishedAt: Date | string | null;
  createdAt: Date | string | null;
  tags?: string[];
  featured?: boolean;
};

/** 精选徽标：星星 + 精选 胶囊（封面右上角叠加 / 无封面时标题行右侧） */
function FeaturedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-300/60 ${className}`}
    >
      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
      精选
    </span>
  );
}

/** 文章卡片（参考站 czhlove.cn 一比一还原）：
 * - 圆角边框卡片，hover 上移+阴影
 * - 日期带日历图标
 * - 标题 font-bold text-lg，hover 变 primary 色
 * - 摘要 line-clamp-3
 * - 封面图可选（顶部 aspect-video）
 */
export function PostCard({ post }: { post: CardPost }) {
  const href = `/posts/${post.slug ?? post.id}`;
  return (
    <Link
      href={href}
      className="group mb-6 flex break-inside-avoid flex-col rounded-xl border border-border bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20"
    >
      {post.coverUrl ? (
        <div className="relative mb-4 -mt-2 aspect-video overflow-hidden rounded-lg">
          <LazyImage
            src={post.coverUrl}
            alt={post.title}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
          {post.featured ? <FeaturedBadge className="absolute right-2 top-2 shadow-sm" /> : null}
        </div>
      ) : null}

      {/* 日期 */}
      <div className="flex items-center text-base text-muted-foreground mb-3">
        <time
          dateTime={formatDate(post.publishedAt ?? post.createdAt)}
          className="flex items-center space-x-1.5"
        >
          <CalendarDays className="h-4 w-4" />
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </time>
      </div>

      {/* 标题（无封面时右侧显示精选徽标） */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold leading-tight text-xl text-foreground group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.featured && !post.coverUrl ? <FeaturedBadge className="mt-0.5 shrink-0" /> : null}
      </div>

      {/* 摘要 */}
      {post.summary ? (
        <p className="mt-3 text-muted-foreground text-base leading-relaxed line-clamp-3">
          {post.summary}
        </p>
      ) : null}

      {/* 标签 */}
      {post.tags && post.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* 更多阅读 */}
      <span className="mt-4 inline-flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        更多阅读 →
      </span>
    </Link>
  );
}

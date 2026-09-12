import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

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
};

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
      className="group mb-5 flex break-inside-avoid flex-col rounded-xl border border-border bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20"
    >
      {post.coverUrl ? (
        <div className="mb-4 -mt-2 aspect-video overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverUrl}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : null}

      {/* 日期 */}
      <div className="flex items-center text-sm text-muted-foreground mb-2">
        <time
          dateTime={formatDate(post.publishedAt ?? post.createdAt)}
          className="flex items-center space-x-1.5"
        >
          <CalendarDays className="h-4 w-4" />
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </time>
      </div>

      {/* 标题 */}
      <h3 className="font-bold leading-tight text-lg text-foreground group-hover:text-primary transition-colors">
        {post.title}
      </h3>

      {/* 摘要 */}
      {post.summary ? (
        <p className="mt-2 text-muted-foreground text-sm leading-relaxed line-clamp-3">
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

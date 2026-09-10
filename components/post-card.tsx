import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/db/schema";

export function PostCard({ post }: { post: Post }) {
  const href = `/posts/${post.slug ?? post.id}`;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition duration-150 hover:-translate-y-0.5 hover:border-fg-faint hover:shadow-sm"
    >
      {post.coverUrl ? (
        <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-selection">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverUrl}
            alt={post.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <p className="font-mono text-xs text-fg-muted">
        {formatDate(post.publishedAt ?? post.createdAt)}
      </p>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-fg group-hover:text-accent">
        {post.title}
      </h2>
      {post.summary ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-fg-muted">
          {post.summary}
        </p>
      ) : null}
      <span className="mt-4 font-mono text-xs text-fg-muted transition group-hover:text-accent">
        更多阅读 →
      </span>
    </Link>
  );
}

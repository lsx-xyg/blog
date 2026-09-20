import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { listAllPosts, setPostTags } from "@/lib/posts/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server";
import { POST_STATUS_VALUES, PostStatus } from "@/lib/types/posts";

export const dynamic = "force-dynamic";

/** 后台：全部文章（含草稿/定时），最新在前 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  const rows = await listAllPosts();
  return NextResponse.json({ posts: rows });
}

/** 后台：创建文章（slug 留空 → 用 ID 兜底，SPEC §4.2；tags 可选，全量写入 post_tags） */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "title 和 content 必填" }, { status: 400 });
  }

  const status = POST_STATUS_VALUES.includes(body.status)
    ? body.status
    : PostStatus.DRAFT;
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : null;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t: unknown) => typeof t === "string")
    : [];

  // 创建文章 + 写入标签在同一个事务内，保证原子性
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(posts)
      .values({
        title: body.title.trim(),
        slug,
        summary: typeof body.summary === "string" ? body.summary : null,
        content: body.content,
        coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : null,
        status,
        featured: Boolean(body.featured),
        scheduledAt:
          body.scheduledAt && !Number.isNaN(Date.parse(body.scheduledAt))
            ? new Date(body.scheduledAt)
            : null,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
      })
      .returning();

    // slug 留空 → 用 ID 兜底
    if (!row.slug) {
      const [updated] = await tx
        .update(posts)
        .set({ slug: row.id })
        .where(eq(posts.id, row.id))
        .returning();
      if (tags.length > 0) await setPostTags(row.id, tags, tx);
      return updated;
    }

    if (tags.length > 0) await setPostTags(row.id, tags, tx);
    return row;
  });

  revalidatePath("/");
  return NextResponse.json({ post: created }, { status: 201 });
}

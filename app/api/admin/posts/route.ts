import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { listAllPosts } from "@/lib/posts";

// TODO(T8): 接入 Better Auth 后需 admin 鉴权（未授权一律 404 伪装）
export const dynamic = "force-dynamic";

/** 后台：全部文章（含草稿/定时），最新在前 */
export async function GET() {
  const rows = await listAllPosts();
  return NextResponse.json({ posts: rows });
}

/** 后台：创建文章（slug 留空 → 用 ID 兜底，SPEC §4.2） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "title 和 content 必填" }, { status: 400 });
  }

  const status = ["DRAFT", "SCHEDULED", "PUBLISHED"].includes(body.status)
    ? body.status
    : "DRAFT";
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : null;

  const [created] = await db
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
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    })
    .returning();

  if (!created.slug) {
    const [updated] = await db
      .update(posts)
      .set({ slug: created.id })
      .where(eq(posts.id, created.id))
      .returning();
    revalidatePath("/");
    return NextResponse.json({ post: updated }, { status: 201 });
  }

  revalidatePath("/");
  return NextResponse.json({ post: created }, { status: 201 });
}

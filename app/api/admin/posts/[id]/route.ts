import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

// TODO(T8): 接入 Better Auth 后需 admin 鉴权（未授权一律 404 伪装）
export const dynamic = "force-dynamic";

/** 后台：更新文章（slug 留空 → 用 ID 兜底；置为 PUBLISHED 时补 publishedAt） */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const existing = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const status = ["DRAFT", "SCHEDULED", "PUBLISHED"].includes(body.status)
    ? body.status
    : existing[0].status;

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.summary === "string") patch.summary = body.summary;
  if (typeof body.content === "string") patch.content = body.content;
  if (typeof body.coverUrl === "string") patch.coverUrl = body.coverUrl;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (body.scheduledAt === null || (typeof body.scheduledAt === "string" && !Number.isNaN(Date.parse(body.scheduledAt)))) {
    patch.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  }
  // slug：显式传空串 → 用 ID 兜底；未传 → 保持原值
  if (typeof body.slug === "string") {
    const trimmed = body.slug.trim();
    patch.slug = trimmed || existing[0].id;
  }
  // 发布时补 publishedAt（已发布则保持）
  if (status === "PUBLISHED" && !existing[0].publishedAt) {
    patch.publishedAt = new Date();
  } else if (status !== "PUBLISHED" && existing[0].status === "PUBLISHED") {
    patch.publishedAt = null;
  }
  patch.status = status;
  patch.updatedAt = new Date();

  const [updated] = await db
    .update(posts)
    .set(patch)
    .where(eq(posts.id, id))
    .returning();

  // 首页 + 文章页即时失效（旧 slug 页也可能已缓存）
  revalidatePath("/");
  revalidatePath(`/posts/${existing[0].slug ?? existing[0].id}`);
  revalidatePath(`/posts/${updated.slug ?? updated.id}`);

  return NextResponse.json({ post: updated });
}

/** 后台：删除文章（关联 post_tags 由外键 CASCADE 清理） */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  const [deleted] = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id });

  if (!deleted) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }
  revalidatePath("/");
  if (existing[0]) revalidatePath(`/posts/${existing[0].slug ?? existing[0].id}`);
  return NextResponse.json({ ok: true });
}

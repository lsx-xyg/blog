import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { db } from "@/db";
import { galleryItems } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 相册项 API（根据 media_id 查询/更新）
 *
 * GET /api/admin/gallery/by-media/[mediaId] - 根据 media_id 查询相册项
 * PUT /api/admin/gallery/by-media/[mediaId] - 更新或创建相册项（标题/描述/精选）
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { mediaId } = await params;

  try {
    const items = await db
      .select()
      .from(galleryItems)
      .where(eq(galleryItems.mediaId, mediaId))
      .limit(1);

    return NextResponse.json({ item: items[0] || null });
  } catch (error) {
    console.error("查询相册项失败：", error);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { mediaId } = await params;

  try {
    const body = await request.json();
    const { title, description, featured } = body;

    // 先查询是否存在
    const existing = await db
      .select()
      .from(galleryItems)
      .where(eq(galleryItems.mediaId, mediaId))
      .limit(1);

    if (existing.length > 0) {
      // 更新
      const updated = await db
        .update(galleryItems)
        .set({
          title: title ?? existing[0].title,
          description: description ?? existing[0].description,
          featured: featured ?? existing[0].featured,
        })
        .where(eq(galleryItems.id, existing[0].id))
        .returning();
      return NextResponse.json({ item: updated[0] });
    } else {
      // 创建
      const created = await db
        .insert(galleryItems)
        .values({
          mediaId,
          title: title || null,
          description: description || null,
          featured: featured ?? false,
        })
        .returning();
      return NextResponse.json({ item: created[0] }, { status: 201 });
    }
  } catch (error) {
    console.error("更新相册项失败：", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import {
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
  setGalleryItemTags,
} from "@/lib/gallery";
import { getOrCreateTags } from "@/lib/tags";

/**
 * 后台相册项 API
 * PUT /api/admin/gallery/[id] - 更新相册项（含标签）
 * DELETE /api/admin/gallery/[id] - 删除相册项
 */

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getGalleryItemById(id);
  if (!existing) {
    return NextResponse.json({ error: "相册项不存在" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { title, description, featured, imageUrl, tags } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (featured !== undefined) updateData.featured = featured;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    const item = await updateGalleryItem(id, updateData);

    // 处理标签（全量替换）
    if (tags && Array.isArray(tags)) {
      const tagIds = await getOrCreateTags(tags);
      await setGalleryItemTags(id, tagIds);
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("更新相册项失败：", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getGalleryItemById(id);
  if (!existing) {
    return NextResponse.json({ error: "相册项不存在" }, { status: 404 });
  }

  await deleteGalleryItem(id);
  return NextResponse.json({ success: true });
}

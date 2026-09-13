import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { getMediaById, updateMedia, deleteMedia } from "@/lib/media";
import { getStorageDriver } from "@/lib/storage";
import { MediaType } from "@/lib/types/media";

/**
 * 后台媒体项 API
 * PUT /api/admin/media/[id] - 更新媒体（改类型、标题、描述）
 * DELETE /api/admin/media/[id] - 删除媒体（同时删除存储中的文件）
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
  const existing = await getMediaById(id);
  if (!existing) {
    return NextResponse.json({ error: "媒体不存在" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { type, title, description, featured } = body;

    const updateData: Record<string, unknown> = {};
    if (type) {
      const upperType = type.toUpperCase();
      if (upperType === MediaType.ARTICLE || upperType === MediaType.GALLERY) {
        updateData.type = upperType as MediaType;
      }
    }
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (featured !== undefined) updateData.featured = Boolean(featured);

    const item = await updateMedia(id, updateData);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("更新媒体失败：", error);
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
  const existing = await getMediaById(id);
  if (!existing) {
    return NextResponse.json({ error: "媒体不存在" }, { status: 404 });
  }

  try {
    // 先删除存储中的文件
    if (existing.storageKey) {
      try {
        const driver = await getStorageDriver();
        await driver.delete(existing.storageKey);
      } catch (error) {
        console.error("删除存储文件失败（数据库记录仍会删除）：", error);
      }
    }

    // 删除数据库记录
    await deleteMedia(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除媒体失败：", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

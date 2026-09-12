import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { findUnusedMedia, batchDeleteMedia } from "@/lib/media";
import { getStorageDriver } from "@/lib/storage";

/**
 * 未使用图片清理 API
 * GET /api/admin/media/unused - 获取未使用的图片列表
 * DELETE /api/admin/media/unused - 批量删除未使用的图片
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const unusedMedia = await findUnusedMedia();
    return NextResponse.json({
      items: unusedMedia,
      total: unusedMedia.length,
    });
  } catch (error) {
    console.error("获取未使用图片失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { ids } = body as { ids?: string[] };

    // 如果没有指定 ids，则删除所有未使用的图片
    let mediaToDelete: Awaited<ReturnType<typeof findUnusedMedia>> = [];
    if (ids && ids.length > 0) {
      // 验证这些 id 是否都是未使用的
      const unusedMedia = await findUnusedMedia();
      const unusedIds = new Set(unusedMedia.map((m) => m.id));
      mediaToDelete = unusedMedia.filter((m) => ids.includes(m.id) && unusedIds.has(m.id));
    } else {
      mediaToDelete = await findUnusedMedia();
    }

    if (mediaToDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: "没有需要删除的图片" });
    }

    // 删除存储中的文件
    const driver = getStorageDriver();
    for (const item of mediaToDelete) {
      if (item.storageKey) {
        try {
          await driver.delete(item.storageKey);
        } catch (error) {
          console.error(`删除存储文件失败（${item.storageKey}）：`, error);
        }
      }
    }

    // 批量删除数据库记录
    const deletedIds = mediaToDelete.map((m) => m.id);
    await batchDeleteMedia(deletedIds);

    return NextResponse.json({
      success: true,
      deleted: deletedIds.length,
      ids: deletedIds,
    });
  } catch (error) {
    console.error("删除未使用图片失败：", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

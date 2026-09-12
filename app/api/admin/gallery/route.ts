import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { listGalleryItems, createGalleryItem, setGalleryItemTags } from "@/lib/gallery";
import { getOrCreateTags } from "@/lib/tags";

/**
 * 后台相册 API
 * GET /api/admin/gallery - 相册列表（含标签）
 * POST /api/admin/gallery - 创建相册项（含标签）
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const items = await listGalleryItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, featured, imageUrl, tags, storageDriver, storageKey } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "图片 URL 不能为空" }, { status: 400 });
    }

    const item = await createGalleryItem({
      title: title ?? null,
      description: description ?? null,
      featured: featured ?? false,
      imageUrl,
      storageDriver: storageDriver ?? "LOCAL",
      storageKey: storageKey ?? null,
    });

    // 处理标签
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagIds = await getOrCreateTags(tags);
      await setGalleryItemTags(item.id, tagIds);
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("创建相册项失败：", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

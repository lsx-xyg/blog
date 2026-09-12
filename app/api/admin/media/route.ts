import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { listMedia, countMedia, createMedia } from "@/lib/media";
import { getStorageDriver } from "@/lib/storage";
import { MediaType, StorageDriverType } from "@/lib/types/media";

/**
 * 后台媒体库 API
 * GET /api/admin/media?type=ARTICLE|GALLERY&search=xxx&page=1&pageSize=20
 * POST /api/admin/media - 上传图片（multipart/form-data）
 */

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  // 验证 type 参数
  let type: MediaType | undefined;
  if (typeParam) {
    const upperType = typeParam.toUpperCase();
    if (upperType === MediaType.ARTICLE || upperType === MediaType.GALLERY) {
      type = upperType as MediaType;
    }
  }

  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    listMedia({ type, search, limit: pageSize, offset }),
    countMedia({ type, search }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const typeParam = formData.get("type") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "未找到上传文件" }, { status: 400 });
    }

    // 验证 type 参数，默认 ARTICLE
    let type: MediaType = MediaType.ARTICLE;
    if (typeParam) {
      const upperType = typeParam.toUpperCase();
      if (upperType === MediaType.ARTICLE || upperType === MediaType.GALLERY) {
        type = upperType as MediaType;
      }
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 调用存储驱动上传
    const driver = getStorageDriver();
    const uploadResult = await driver.upload(buffer, file.name, file.type);

    // 创建媒体记录
    const mediaRecord = await createMedia({
      type,
      url: uploadResult.url,
      storageDriver: driver.name.toUpperCase() as StorageDriverType,
      storageKey: uploadResult.key,
      title: file.name.replace(/\.[^.]+$/, ""),
      mimeType: file.type,
      size: file.size,
      uploadedBy: session.user.id,
    });

    return NextResponse.json(mediaRecord, { status: 201 });
  } catch (error) {
    console.error("上传媒体失败：", error);
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/utils";
import { getStorageDriver, validateImage } from "@/lib/storage";

/** 上传图片 API
 *
 * POST /api/upload
 * - Content-Type: multipart/form-data
 * - 字段：file（图片文件）
 * - 鉴权：仅管理员可上传
 * - 限制：10MB，jpg/png/webp/gif
 * - 返回：{ url, key, size, mimeType }
 *
 * DELETE /api/upload?key=xxx
 * - 删除指定 key 的图片
 * - 鉴权：仅管理员可删除
 */

export async function POST(request: NextRequest) {
  try {
    // 鉴权：仅管理员可上传
    const session = await auth.api.getSession({ headers: request.headers });
    if (!isAdminUser(session?.user)) {
      return NextResponse.json({ error: "无权限上传" }, { status: 403 });
    }

    // 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "未找到上传文件" }, { status: 400 });
    }

    // 校验图片格式和大小
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 调用存储驱动上传
    const driver = getStorageDriver();
    const result = await driver.upload(buffer, file.name, file.type);

    // 返回结果中包含 storageDriver，用于后续删除时选择对应平台
    return NextResponse.json({
      ...result,
      storageDriver: driver.name.toUpperCase(),
    });
  } catch (error) {
    console.error("[upload] 上传失败：", error);
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 鉴权：仅管理员可删除
    const session = await auth.api.getSession({ headers: request.headers });
    if (!isAdminUser(session?.user)) {
      return NextResponse.json({ error: "无权限删除" }, { status: 403 });
    }

    // 获取 key 参数
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "缺少 key 参数" }, { status: 400 });
    }

    // 调用存储驱动删除
    const driver = getStorageDriver();
    await driver.delete(key);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("[upload] 删除失败：", error);
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

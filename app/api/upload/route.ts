import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { isAdminUser } from '@/lib/shared';
import { getStorageDriver, getStorageDriverForPlatform, validateImage } from '@/lib/storage/server';
import { StorageChannel } from '@/lib/storage/shared/channels';
import { probeImageDimensions, resolveMediaPlatform } from '@/lib/media/server';

/** 上传图片 API
 *
 * POST /api/upload
 * - Content-Type: multipart/form-data
 * - 字段：file（图片文件）
 * - 鉴权：仅管理员可上传
 * - 限制：10MB，jpg/png/webp/gif
 * - 返回：{ url（站内 /m/{key}）, key, size, mimeType, width, height, storageDriver }
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
      return NextResponse.json({ error: '无权限上传' }, { status: 403 });
    }

    // 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });
    }

    // 校验图片格式和大小
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 按通道解析驱动：编辑器上传固定走「文章图片」通道（绑定档案见后台存储设置）
    const driver = await getStorageDriver(StorageChannel.UPLOAD);
    const result = await driver.upload(buffer, file.name, file.type);

    // 探测原始宽高：编辑器插入正文时可带上尺寸，避免图片布局抖动
    const dimensions = await probeImageDimensions(buffer);

    // 返回站内路由地址（/m/{key}），由 app/m/[...key] 按**入库时平台**解析档案并流式代理
    // 到真实 CDN（仅回源失败/本地驱动才退回 302）。文章/媒体库持久化站内地址，
    // 后台切换档案或 CDN 时历史图片无需迁移。
    // 结果中包含 storageDriver，用于后续删除时选择对应平台
    return NextResponse.json({
      ...result,
      url: `/m/${result.key}`,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      storageDriver: driver.name.toUpperCase(),
    });
  } catch (error) {
    console.error('[upload] 上传失败：', error);
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 鉴权：仅管理员可删除
    const session = await auth.api.getSession({ headers: request.headers });
    if (!isAdminUser(session?.user)) {
      return NextResponse.json({ error: '无权限删除' }, { status: 403 });
    }

    // 获取 key 参数
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
    }

    // 按入库时平台反查驱动删除（历史文件跟着当时的平台走，不受当前绑定影响）
    const platform = await resolveMediaPlatform(key);
    const driver =
      (platform ? await getStorageDriverForPlatform(platform, 'public') : null) ??
      (await getStorageDriver(StorageChannel.UPLOAD));
    await driver.delete(key);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('[upload] 删除失败：', error);
    const message = error instanceof Error ? error.message : '删除失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

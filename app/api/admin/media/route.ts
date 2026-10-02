import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { headers } from 'next/headers';
import { isAdminUser } from '@/lib/shared';
import { listMedia, countMedia, createMedia, probeImageDimensions } from '@/lib/media/server';
import { getStorageDriver } from '@/lib/storage/server';
import { StorageChannel } from '@/lib/storage/shared/channels';
import { MediaType } from '@/lib/types/media';
import { StorageDriverType } from '@/lib/types/storage';

/**
 * 媒体类型 → 存储通道（media.type 决定图片进哪个档案）
 *
 * 显式分支约定：
 * - GALLERY       → 相册通道
 * - ARTICLE       → 上传通道（文章配图）
 * - VIDEO_POSTER  → 上传通道（视频封面与文章图同池；该类型不参与图片 Tab 列表与
 *                   media-picker，仅服务 videos.posterMediaId，见 lib/media/server/store）
 */
function channelForMediaType(type: MediaType): StorageChannel {
  if (type === MediaType.GALLERY) return StorageChannel.GALLERY;
  return StorageChannel.UPLOAD;
}

/**
 * 后台媒体库 API
 * GET /api/admin/media?type=ARTICLE|GALLERY&search=xxx&page=1&pageSize=20
 * POST /api/admin/media - 上传图片（multipart/form-data）
 */

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const search = searchParams.get('search') || undefined;
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Number.parseInt(searchParams.get('pageSize') || '20', 10);

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
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const typeParam = formData.get('type') as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });
    }

    // 验证 type 参数，默认 ARTICLE（ARTICLE / GALLERY / VIDEO_POSTER）
    let type: MediaType = MediaType.ARTICLE;
    if (typeParam) {
      const upperType = typeParam.toUpperCase();
      if (
        upperType === MediaType.ARTICLE ||
        upperType === MediaType.GALLERY ||
        upperType === MediaType.VIDEO_POSTER
      ) {
        type = upperType as MediaType;
      }
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 按媒体类型路由到对应通道（文章图 → upload，相册 → gallery，绑定见后台存储设置）
    const driver = await getStorageDriver(channelForMediaType(type));
    const uploadResult = await driver.upload(buffer, file.name, file.type);

    // 探测原始宽高：供前端 next/image 以原始比例渲染（相册瀑布流必需）
    const dimensions = await probeImageDimensions(buffer);

    // 媒体库持久化站内路由地址（/m/{key}），由 app/m/[...key] 按入库时平台解析档案
    // 并流式代理真实 CDN（仅回源失败或本地驱动才退回 302）；
    // 后台切换档案/CDN 时历史图片无需迁移
    const mediaRecord = await createMedia({
      type,
      url: `/m/${uploadResult.key}`,
      storageDriver: driver.name.toUpperCase() as StorageDriverType,
      storageKey: uploadResult.key,
      title: file.name.replace(/\.[^.]+$/, ''),
      mimeType: file.type,
      size: file.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      uploadedBy: session.user.id,
    });

    return NextResponse.json(mediaRecord, { status: 201 });
  } catch (error) {
    console.error('上传媒体失败：', error);
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

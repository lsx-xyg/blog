import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { headers } from 'next/headers';
import { isAdminUser } from '@/lib/shared';
import { getStorageDriver } from '@/lib/storage/server';
import { StorageChannel } from '@/lib/storage/shared/channels';
import { getConfig } from '@/lib/settings/server';
import { DEFAULT_MAX_VIDEO_SIZE } from '@/lib/types/video';
import { validateVideoUpload, presignCodeForDriver } from '@/lib/videos/server/validate';

export const dynamic = 'force-dynamic';

/**
 * 视频预签名上传
 * POST /api/admin/videos/presign
 * body: { contentType: string; size?: number }
 *
 * 返回（200 + code 业务分支）：
 * - 正常：{ presignedUrl, key, url, driver }
 * - LOCAL：{ code: 'PRESIGN_UNSUPPORTED', driver: 'LOCAL' } → 前端走 multipart 降级
 * - GITHUB/WEBDAV：{ code: 'VIDEO_DRIVER_UNSUPPORTED', driver } → 前端拒绝并提示
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      contentType?: string;
      size?: number;
    } | null;
    const contentType = body?.contentType;
    const size = typeof body?.size === 'number' ? body.size : undefined;

    const maxSizeMb = await getConfig('video.maxSizeMb');
    const maxSizeBytes = (maxSizeMb ?? DEFAULT_MAX_VIDEO_SIZE / 1024 / 1024) * 1024 * 1024;

    const check = validateVideoUpload({ mimeType: contentType, size, maxSizeBytes });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    // validate 通过后 contentType 必为受支持的非空值，收窄类型
    const mime = contentType as string;

    const driver = await getStorageDriver(StorageChannel.VIDEO);

    if (!driver.supportsPresignedUpload) {
      const code = presignCodeForDriver(driver.name);
      return NextResponse.json({
        code,
        driver: driver.name.toUpperCase(),
        error:
          code === 'PRESIGN_UNSUPPORTED'
            ? '当前存储驱动为 LOCAL，不支持预签名直传，将使用普通上传'
            : `当前存储驱动（${driver.name}）不适合视频，请先在存储设置中将「视频相册」绑定到 S3 档案`,
      });
    }

    const result = await driver.getPresignedUploadUrl({ contentType: mime, expiresIn: 600 });

    return NextResponse.json({
      presignedUrl: result.presignedUrl,
      key: result.key,
      url: result.url,
      driver: driver.name.toUpperCase(),
    });
  } catch (error) {
    console.error('视频预签名失败：', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '预签名失败' },
      { status: 500 },
    );
  }
}

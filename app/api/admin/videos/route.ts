import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { headers } from 'next/headers';
import { isAdminUser } from '@/lib/shared';
import { getStorageDriver } from '@/lib/storage/server';
import { StorageChannel } from '@/lib/storage/shared/channels';
import { getConfig } from '@/lib/settings/server';
import { DEFAULT_MAX_VIDEO_SIZE } from '@/lib/types/video';
import { listVideos, countVideos, createVideo, getPosterMap } from '@/lib/videos/server';
import { validateVideoUpload } from '@/lib/videos/server/validate';
import { isValidVideoStatus } from '@/lib/videos/shared/video';
import { VideoStatus } from '@/lib/types/video';
import { StorageDriverType } from '@/lib/types/storage';

export const dynamic = 'force-dynamic';

/** 解析表单里的数字字段（空串/缺省 → null） */
function parseNum(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * 后台视频列表
 * GET /api/admin/videos?status=PUBLISHED&search=xxx&page=1&pageSize=12
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const search = searchParams.get('search') || undefined;
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Number.parseInt(searchParams.get('pageSize') || '12', 10);

  const status =
    statusParam && isValidVideoStatus(statusParam) ? (statusParam as VideoStatus) : undefined;

  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    listVideos({ status, search, limit: pageSize, offset }),
    countVideos({ status, search }),
  ]);

  // 批量取封面 URL（列表展示用）
  const posterMap = await getPosterMap(items.map((v) => v.posterMediaId));
  const rows = items.map((v) => ({
    ...v,
    posterUrl: v.posterMediaId ? (posterMap.get(v.posterMediaId) ?? '') : '',
  }));

  return NextResponse.json({
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

/**
 * 视频上传（双用途，按 Content-Type 分叉）
 *
 * 1. multipart/form-data —— LOCAL 降级：服务端接收文件并落库
 *    fields: file, durationSeconds?, width?, height?, title?
 * 2. application/json —— 预签名直传回调：视频已由前端直传对象存储，凭 key 落库
 *    body: { key, url?, mimeType, size, durationSeconds?, width?, height?, title? }
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  const driver = await getStorageDriver(StorageChannel.VIDEO);

  try {
    // ---------- 分支 1：multipart（LOCAL 降级） ----------
    if (contentType.includes('multipart/form-data')) {
      // 服务端兜底：multipart 只允许 LOCAL（其他驱动必须走预签名，避免 Vercel body 限制/大文件入库）
      if (driver.name !== 'local') {
        return NextResponse.json(
          { error: `当前存储驱动（${driver.name}）不支持 multipart 上传视频，请使用直传` },
          { status: 400 },
        );
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });
      }

      const maxSizeMb = await getConfig('video.maxSizeMb');
      const maxSizeBytes = (maxSizeMb ?? DEFAULT_MAX_VIDEO_SIZE / 1024 / 1024) * 1024 * 1024;
      const check = validateVideoUpload({ mimeType: file.type, size: file.size, maxSizeBytes });
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = await driver.upload(buffer, file.name, file.type);

      const record = await createVideo({
        title: typeof formData.get('title') === 'string' ? (formData.get('title') as string) : null,
        storageKey: upload.key,
        storageDriver: StorageDriverType.LOCAL,
        url: upload.url,
        mimeType: file.type,
        size: file.size,
        durationSeconds: parseNum(formData.get('durationSeconds')),
        width: parseNum(formData.get('width')),
        height: parseNum(formData.get('height')),
        posterMediaId:
          typeof formData.get('posterMediaId') === 'string'
            ? (formData.get('posterMediaId') as string)
            : null,
        uploadedBy: session.user.id,
      });

      return NextResponse.json(record, { status: 201 });
    }

    // ---------- 分支 2：预签名回调 ----------
    const body = (await request.json().catch(() => null)) as {
      key?: string;
      url?: string;
      mimeType?: string;
      size?: number;
      durationSeconds?: number;
      width?: number;
      height?: number;
      title?: string;
      posterMediaId?: string;
    } | null;

    if (!body?.key || !body?.mimeType) {
      return NextResponse.json({ error: '缺少存储键或 MIME 类型' }, { status: 400 });
    }

    const maxSizeMb = await getConfig('video.maxSizeMb');
    const maxSizeBytes = (maxSizeMb ?? DEFAULT_MAX_VIDEO_SIZE / 1024 / 1024) * 1024 * 1024;
    const check = validateVideoUpload({ mimeType: body.mimeType, size: body.size, maxSizeBytes });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    // 直链：回调显式给 url（公开 bucket）→ 否则尝试 getUrl，无 publicBase 时为空串
    let url = body.url ?? '';
    if (!url) {
      try {
        url = driver.getUrl(body.key);
      } catch {
        url = '';
      }
    }

    const record = await createVideo({
      title: body.title ?? null,
      storageKey: body.key,
      storageDriver: driver.name.toUpperCase() as StorageDriverType,
      url: url || null,
      mimeType: body.mimeType,
      size: body.size ?? null,
      durationSeconds: body.durationSeconds ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      posterMediaId: typeof body.posterMediaId === 'string' ? body.posterMediaId : null,
      uploadedBy: session.user.id,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('视频上传失败：', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 },
    );
  }
}

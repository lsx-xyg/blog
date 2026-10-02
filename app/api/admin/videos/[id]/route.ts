import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { headers } from 'next/headers';
import { isAdminUser } from '@/lib/shared';
import { getStorageDriverForPlatform } from '@/lib/storage/server';
import { getVideoById, getVideoWithPoster, updateVideo, deleteVideo } from '@/lib/videos/server';
import { getMediaById, isMediaReferenced, deleteMedia } from '@/lib/media/server';
import { isValidVideoStatus, isValidVideoVisibility } from '@/lib/videos/shared/video';
import { VideoStatus, VideoVisibility } from '@/lib/types/video';
import { StorageDriverType } from '@/lib/types/storage';

export const dynamic = 'force-dynamic';

/** 后台视频详情 / 编辑 / 删除 */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const row = await getVideoWithPoster(id);
  if (!row) return NextResponse.json({ error: '视频不存在' }, { status: 404 });

  return NextResponse.json({ ...row.video, posterUrl: row.posterUrl });
}

/** PATCH：编辑字段（白名单校验后透传 updateVideo） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: '请求体无效' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if ('title' in body) patch.title = typeof body.title === 'string' ? body.title : null;
  if ('description' in body) {
    patch.description = typeof body.description === 'string' ? body.description : null;
  }
  if ('location' in body) patch.location = typeof body.location === 'string' ? body.location : null;
  if ('posterMediaId' in body) {
    patch.posterMediaId =
      typeof body.posterMediaId === 'string' && body.posterMediaId ? body.posterMediaId : null;
  }
  if ('takenAt' in body) {
    patch.takenAt =
      typeof body.takenAt === 'string' && body.takenAt ? new Date(body.takenAt) : null;
  }
  if ('tags' in body) {
    patch.tags = Array.isArray(body.tags)
      ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : null;
  }
  if ('sortOrder' in body) {
    patch.sortOrder = typeof body.sortOrder === 'number' ? Math.floor(body.sortOrder) : 0;
  }
  if ('durationSeconds' in body) {
    patch.durationSeconds =
      typeof body.durationSeconds === 'number' && body.durationSeconds >= 0
        ? body.durationSeconds
        : null;
  }
  if ('width' in body) {
    patch.width = typeof body.width === 'number' && body.width >= 0 ? body.width : null;
  }
  if ('height' in body) {
    patch.height = typeof body.height === 'number' && body.height >= 0 ? body.height : null;
  }
  if ('status' in body) {
    if (!isValidVideoStatus(body.status)) {
      return NextResponse.json({ error: '无效的发布状态' }, { status: 400 });
    }
    patch.status = body.status as VideoStatus;
  }
  if ('visibility' in body) {
    if (!isValidVideoVisibility(body.visibility)) {
      return NextResponse.json({ error: '无效的可见性' }, { status: 400 });
    }
    patch.visibility = body.visibility as VideoVisibility;
  }

  const record = await updateVideo(id, patch);
  if (!record) return NextResponse.json({ error: '视频不存在' }, { status: 404 });

  return NextResponse.json(record);
}

/**
 * DELETE：删除视频
 * 1. 删除视频文件（按入库时 storageDriver 反查档案）
 * 2. 删除 videos 记录
 * 3. 封面联动：若 posterMediaId 存在且对应 media 未被文章引用 → 一并删封面记录与封面文件
 *    （被引用则跳过，留给后续人工处理；findUnusedMedia 排除 VIDEO_POSTER 仅是兜底）
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return NextResponse.json({ error: '视频不存在' }, { status: 404 });

  try {
    // 1. 删除视频本体文件
    if (video.storageKey) {
      const driver = await getStorageDriverForPlatform(video.storageDriver as StorageDriverType);
      if (driver) {
        await driver.delete(video.storageKey);
      }
    }

    // 2. 删除 videos 记录
    await deleteVideo(id);

    // 3. 封面联动删除（未被引用才删）
    let posterDeleted = false;
    if (video.posterMediaId) {
      const mediaRecord = await getMediaById(video.posterMediaId);
      if (mediaRecord && !(await isMediaReferenced(video.posterMediaId))) {
        if (mediaRecord.storageKey) {
          const posterDriver = await getStorageDriverForPlatform(
            mediaRecord.storageDriver as StorageDriverType,
          );
          if (posterDriver) {
            await posterDriver.delete(mediaRecord.storageKey);
          }
        }
        await deleteMedia(video.posterMediaId);
        posterDeleted = true;
      }
    }

    return NextResponse.json({ ok: true, posterDeleted });
  } catch (error) {
    console.error('删除视频失败：', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 },
    );
  }
}

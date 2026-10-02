import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/server';
import { isAdminUser } from '@/lib/shared';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { getStorageDriver, getStorageDriverForPlatform } from '@/lib/storage/server';
import { StorageChannel } from '@/lib/storage/shared/channels';
import { deleteMedia, getMediaById, isMediaReferenced } from '@/lib/media/server/store';
import { listOrphanVideoPosters } from '@/lib/videos/server/orphans';

/**
 * 孤儿封面清理（Phase 4 Step C3，后台手动入口）
 *
 * GET  /api/admin/media/orphans          → 预览：未引用 VIDEO_POSTER 列表
 * DELETE /api/admin/media/orphans        → body { ids: string[] } 逐条复核删除
 *
 * 删除逐条复核（不批量，不信任前端）：
 * 1) getMediaById(id) → 不存在，跳过
 * 2) videos.posterMediaId = id → 存在，跳过（刚被引用）
 * 3) isMediaReferenced(id) → true，跳过（被文章引用）
 * 4) 全部通过 → 删存储文件 + 删 media 记录
 */
async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const items = await listOrphanVideoPosters();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('扫描孤儿封面失败：', error);
    return NextResponse.json({ error: '扫描失败' }, { status: 500 });
  }
}

type DeleteResult = {
  id: string;
  ok: boolean;
  reason?: string;
};

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids 不能为空' }, { status: 400 });
    }

    const fallbackDriver = await getStorageDriver(StorageChannel.UPLOAD);
    const results: DeleteResult[] = [];

    // 逐条复核 + 删除（每条都现查现删，不批量）
    for (const id of ids) {
      // 1) 存在性
      const item = await getMediaById(id);
      if (!item) {
        results.push({ id, ok: false, reason: '记录不存在，跳过' });
        continue;
      }

      // 2) 是否被任何视频引用（含 DRAFT，只要 posterMediaId 指向即算）
      const [ref] = await db
        .select({ id: videos.id })
        .from(videos)
        .where(eq(videos.posterMediaId, id))
        .limit(1);
      if (ref) {
        results.push({ id, ok: false, reason: '已被视频引用，跳过' });
        continue;
      }

      // 3) 是否被文章内容引用
      if (await isMediaReferenced(id)) {
        results.push({ id, ok: false, reason: '已被文章引用，跳过' });
        continue;
      }

      // 4a) 删存储文件（按入库时平台反查驱动；查不到回退当前公开通道）
      if (item.storageKey) {
        try {
          const platform = item.storageDriver ?? null;
          const driver =
            (platform ? await getStorageDriverForPlatform(platform, 'public') : null) ??
            fallbackDriver;
          await driver.delete(item.storageKey);
        } catch (error) {
          console.error(`删除孤儿封面存储文件失败（${item.storageKey}）：`, error);
          results.push({ id, ok: false, reason: '存储删除失败，记录保留' });
          continue;
        }
      }

      // 4b) 删 media 记录
      try {
        await deleteMedia(id);
        results.push({ id, ok: true });
      } catch (error) {
        console.error(`删除孤儿封面记录失败（${id}）：`, error);
        results.push({ id, ok: false, reason: '数据库删除失败，记录保留' });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ results, okCount, failCount: results.length - okCount });
  } catch (error) {
    console.error('删除孤儿封面失败：', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

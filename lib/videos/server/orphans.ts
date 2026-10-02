/**
 * 孤儿视频封面清理（Phase 4 Step C3）
 *
 * 孤儿定义（用户确认）：
 * - 所有 VIDEO_POSTER 类型的 media
 * - 减去被任何 videos.posterMediaId 引用的（不查视频状态，DRAFT/PUBLISHED 都算引用）
 * - 三种孤儿来源：视频被删 / 用户移除封面 / 上传封面后取消编辑
 *
 * 删除时逐条双重复核（不在本文件，见 app/api/admin/media/orphans/route.ts）：
 * 1) getMediaById 存在性；2) videos.posterMediaId 引用；3) isMediaReferenced（文章引用）
 * 全部通过才删存储文件 + media 记录
 *
 * 纯函数（filterOrphanPosters）在 lib/videos/shared/orphans.ts，此处 re-export
 * 避免本文件 import @/db 导致纯函数测试不可用。
 */
import { isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { MediaType } from '@/lib/types/media';
import { isMediaReferenced, listMedia } from '@/lib/media/server/store';
import { filterOrphanPosters } from '@/lib/videos/shared/orphans';

export { filterOrphanPosters, type PosterCandidate } from '@/lib/videos/shared/orphans';

/** 孤儿封面完整信息（前端预览用） */
export type OrphanPoster = {
  id: string;
  url: string;
  storageKey: string | null;
  storageDriver: string | null;
  size: number | null;
  createdAt: string;
};

/**
 * 扫描孤儿封面（后台「清理孤儿封面」预览数据源）
 *
 * 1. 全量取 VIDEO_POSTER media（listMedia 传 type 时不做排除）
 * 2. 取所有 videos.posterMediaId（含 DRAFT/ARCHIVED，只要指向即算引用）
 * 3. 逐个 isMediaReferenced（文章内容 url 引用）
 * 4. filterOrphanPosters 纯函数过滤
 */
export async function listOrphanVideoPosters(): Promise<OrphanPoster[]> {
  const posters = await listMedia({ type: MediaType.VIDEO_POSTER });

  const rows = await db
    .select({ posterMediaId: videos.posterMediaId })
    .from(videos)
    .where(isNotNull(videos.posterMediaId));
  const referencedPosterIds = new Set(
    rows.map((r) => r.posterMediaId).filter((v): v is string => !!v),
  );

  const referencedUrls = new Set<string>();
  for (const p of posters) {
    if (await isMediaReferenced(p.id)) referencedUrls.add(p.url);
  }

  const orphans = filterOrphanPosters(posters, referencedPosterIds, referencedUrls);
  const orphanIds = new Set(orphans.map((o) => o.id));

  return posters
    .filter((p) => orphanIds.has(p.id))
    .map((p) => ({
      id: p.id,
      url: p.url,
      storageKey: p.storageKey,
      storageDriver: p.storageDriver,
      size: p.size,
      createdAt: p.createdAt ? p.createdAt.toISOString() : '',
    }));
}

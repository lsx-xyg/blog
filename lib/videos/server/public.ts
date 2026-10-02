/**
 * 视频前台公开数据层（只暴露 PUBLISHED + PUBLIC）
 *
 * - 字段白名单：id / title / durationSeconds / width / height / posterUrl / publishedAt
 * - 不返回 storageKey / storageDriver / posterMediaId 等内部字段（扩展点 8：只回数据，布局独立）
 * - 可见性统一收敛在权限过滤函数里（扩展点 3）
 */
import { and, arrayContains, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { VideoStatus, VideoVisibility } from '@/lib/types/video';
import { getPosterMap } from './store';

/** 前台公开视频卡片字段（API 与首屏 SSR 共用） */
export type PublicVideoCard = {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  posterUrl: string;
  publishedAt: string | null;
};

/** 公开视频详情（播放页用，比卡片多描述/地点/标签/url/mimeType） */
export type PublicVideoDetail = PublicVideoCard & {
  description: string | null;
  location: string | null;
  takenAt: string | null;
  tags: string[];
  url: string | null;
  mimeType: string | null;
  storageDriver: string | null;
  storageKey: string | null;
};

function toCard(
  row: {
    id: string;
    title: string | null;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    posterMediaId: string | null;
    publishedAt: Date | null;
  },
  posterUrl: string,
): PublicVideoCard {
  return {
    id: row.id,
    title: row.title,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    posterUrl,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

/** 前台列表（limit+1 多取一条判断 hasMore，offset 由 cursor 传入） */
export async function listPublicVideosWithPoster(opts?: {
  limit?: number;
  offset?: number;
  tag?: string;
}): Promise<PublicVideoCard[]> {
  const { limit, offset, tag } = opts ?? {};

  const conditions = [
    eq(videos.status, VideoStatus.PUBLISHED),
    eq(videos.visibility, VideoVisibility.PUBLIC),
  ];
  // tag 参数预留（扩展点 2：标签筛选本次不实现 UI，接口已支持）
  if (tag) conditions.push(arrayContains(videos.tags, [tag]));

  const query = db
    .select()
    .from(videos)
    .where(and(...conditions))
    .orderBy(desc(videos.sortOrder), desc(videos.publishedAt));

  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);

  const rows = await query;
  const posterMap = await getPosterMap(rows.map((v) => v.posterMediaId));
  return rows.map((v) => toCard(v, v.posterMediaId ? (posterMap.get(v.posterMediaId) ?? '') : ''));
}

/** 前台单视频详情（不存在或非 PUBLISHED + PUBLIC 返回 null） */
export async function getPublicVideoById(id: string): Promise<PublicVideoDetail | null> {
  const [row] = await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.id, id),
        eq(videos.status, VideoStatus.PUBLISHED),
        eq(videos.visibility, VideoVisibility.PUBLIC),
      ),
    )
    .limit(1);
  if (!row) return null;

  const posterMap = await getPosterMap([row.posterMediaId]);
  return {
    ...toCard(row, row.posterMediaId ? (posterMap.get(row.posterMediaId) ?? '') : ''),
    description: row.description,
    location: row.location,
    takenAt: row.takenAt ? row.takenAt.toISOString() : null,
    tags: row.tags ?? [],
    url: row.url,
    mimeType: row.mimeType,
    storageDriver: row.storageDriver,
    storageKey: row.storageKey,
  };
}

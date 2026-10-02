/**
 * 视频相册数据访问层（个人生活视频相册）
 *
 * 与 lib/media/server/store.ts 同构：
 * - 删除记录与删除存储分离（调用方按返回的 storageKey/storageDriver 清存储）
 * - 前台查询只暴露 PUBLISHED + PUBLIC
 * - 扩展点字段（albumId/tags/visibility/viewCount/source/thumbnails）已在 schema 落位，
 *   本层提供对应查询/写入入口，后续做相册/标签筛选 UI 时直接复用
 */
import { and, desc, eq, ilike, or, arrayContains, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { videos, media } from '@/db/schema';
import { VideoStatus, VideoVisibility } from '@/lib/types/video';
import { StorageDriverType } from '@/lib/types/storage';

/** 创建视频记录（status=PUBLISHED 且未指定 publishedAt 时自动补 now） */
export async function createVideo(data: {
  title?: string | null;
  description?: string | null;
  storageKey?: string | null;
  storageDriver?: StorageDriverType;
  url?: string | null;
  posterMediaId?: string | null;
  mimeType?: string | null;
  size?: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  status?: VideoStatus;
  sortOrder?: number;
  publishedAt?: Date | null;
  takenAt?: Date | null;
  location?: string | null;
  tags?: string[] | null;
  visibility?: VideoVisibility;
  albumId?: string | null;
  source?: 'UPLOAD' | 'IMPORT' | 'SYNC';
  uploadedBy?: string | null;
}) {
  const rows = await db
    .insert(videos)
    .values({
      title: data.title ?? null,
      description: data.description ?? null,
      storageKey: data.storageKey ?? null,
      storageDriver: data.storageDriver ?? StorageDriverType.LOCAL,
      url: data.url ?? null,
      posterMediaId: data.posterMediaId ?? null,
      mimeType: data.mimeType ?? null,
      size: data.size ?? null,
      durationSeconds: data.durationSeconds ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      status: data.status ?? VideoStatus.DRAFT,
      sortOrder: data.sortOrder ?? 0,
      publishedAt: data.publishedAt ?? (data.status === VideoStatus.PUBLISHED ? new Date() : null),
      takenAt: data.takenAt ?? null,
      location: data.location ?? null,
      tags: data.tags ?? null,
      visibility: data.visibility ?? VideoVisibility.PUBLIC,
      albumId: data.albumId ?? null,
      source: data.source ?? 'UPLOAD',
      uploadedBy: data.uploadedBy ?? null,
    })
    .returning();
  return rows[0];
}

/** 按 id 查询视频 */
export async function getVideoById(id: string) {
  const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 后台视频列表（全部状态，支持按状态筛选、搜索、分页） */
export async function listVideos(opts?: {
  status?: VideoStatus;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, search, limit, offset } = opts ?? {};

  const conditions = [];
  if (status) conditions.push(eq(videos.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(videos.title, `%${search}%`),
        ilike(videos.description, `%${search}%`),
        ilike(videos.location, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db.select().from(videos).orderBy(desc(videos.sortOrder), desc(videos.createdAt));

  if (where) query.where(where);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);

  return query;
}

/** 统计视频数量 */
export async function countVideos(opts?: { status?: VideoStatus; search?: string }) {
  const { status, search } = opts ?? {};

  const conditions = [];
  if (status) conditions.push(eq(videos.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(videos.title, `%${search}%`),
        ilike(videos.description, `%${search}%`),
        ilike(videos.location, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(videos)
    .where(where ?? sql`true`);

  return Number(result[0]?.count ?? 0);
}

/**
 * 前台公开视频列表（仅 PUBLISHED + PUBLIC）
 * 排序：sortOrder 降序（后台手动置顶）→ publishedAt 降序（最新在前）
 * tag 参数：按标签筛选（扩展点 2 预留，前台标签筛选 UI 直接复用）
 */
export async function listPublicVideos(opts?: { limit?: number; offset?: number; tag?: string }) {
  const { limit, offset, tag } = opts ?? {};

  const conditions = [
    eq(videos.status, VideoStatus.PUBLISHED),
    eq(videos.visibility, VideoVisibility.PUBLIC),
  ];
  if (tag) conditions.push(arrayContains(videos.tags, [tag]));

  const query = db
    .select()
    .from(videos)
    .where(and(...conditions))
    .orderBy(desc(videos.sortOrder), desc(videos.publishedAt));

  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);

  return query;
}

/** 前台公开视频总数（无限滚动分页用） */
export async function countPublicVideos(tag?: string) {
  const conditions = [
    eq(videos.status, VideoStatus.PUBLISHED),
    eq(videos.visibility, VideoVisibility.PUBLIC),
  ];
  if (tag) conditions.push(arrayContains(videos.tags, [tag]));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(videos)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}

/** 更新视频记录（updatedAt 自动刷新；转 PUBLISHED 时补 publishedAt） */
export async function updateVideo(
  id: string,
  data: {
    title?: string | null;
    description?: string | null;
    storageKey?: string | null;
    storageDriver?: StorageDriverType;
    url?: string | null;
    posterMediaId?: string | null;
    mimeType?: string | null;
    size?: number | null;
    durationSeconds?: number | null;
    width?: number | null;
    height?: number | null;
    status?: VideoStatus;
    sortOrder?: number;
    publishedAt?: Date | null;
    takenAt?: Date | null;
    location?: string | null;
    tags?: string[] | null;
    visibility?: VideoVisibility;
    albumId?: string | null;
    source?: 'UPLOAD' | 'IMPORT' | 'SYNC';
    thumbnails?: string[] | null;
  },
) {
  const existing = await getVideoById(id);
  if (!existing) return null;

  const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };

  // 发布状态迁移时补 publishedAt（下架/草稿不修改已发布的 publishedAt）
  if (data.status === VideoStatus.PUBLISHED && !existing.publishedAt && !data.publishedAt) {
    patch.publishedAt = new Date();
  }
  // 显式传 null 的字段（如清空标签/描述）不能被 spread 吞掉
  const rows = await db.update(videos).set(patch).where(eq(videos.id, id)).returning();
  return rows[0] ?? null;
}

/**
 * 删除视频记录（返回被删记录，调用方负责按 storageKey/storageDriver 清理存储文件；
 * 封面 posterMediaId 不级联删——留给「未使用图片清理」统一回收）
 */
export async function deleteVideo(id: string) {
  const rows = await db.delete(videos).where(eq(videos.id, id)).returning();
  return rows[0] ?? null;
}

/** 视频 + 封面信息（join media 表取封面 URL，前台播放页/瀑布流卡片用） */
export async function getVideoWithPoster(id: string) {
  const rows = await db
    .select({
      video: videos,
      posterUrl: media.url,
      posterStorageKey: media.storageKey,
    })
    .from(videos)
    .leftJoin(media, eq(videos.posterMediaId, media.id))
    .where(eq(videos.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 批量封面映射（列表页用：mediaIds → media.url；空集合返回空 Map） */
export async function getPosterMap(
  mediaIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({ id: media.id, url: media.url })
    .from(media)
    .where(inArray(media.id, ids));

  return new Map(rows.map((r) => [r.id, r.url ?? '']));
}

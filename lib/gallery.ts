/**
 * 相册数据访问层（T5：列表/详情/CRUD；T7：全量轻量元数据 + 服务端过滤预留）
 *
 * 重构说明：gallery_items 表已删除，相册图片统一在 media 表管理（type=GALLERY）。
 * 精选字段（featured）也在 media 表中。标签通过 media_tags 关联表管理。
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tags, mediaTags, media } from "@/db/schema";
import { MediaType } from "@/lib/types/media";

/** 相册项（即 media 表中 type=GALLERY 的记录） */
export type GalleryItemWithMedia = {
  id: string;
  title: string | null;
  description: string | null;
  featured: boolean;
  createdAt: Date;
  // media 表字段
  imageUrl: string;
  storageDriver: string;
  storageKey: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
};

/** 相册列表（按创建时间倒序，支持分页） */
export async function listGalleryItems(opts?: {
  limit?: number;
  offset?: number;
  featured?: boolean;
}): Promise<GalleryItemWithMedia[]> {
  const { limit, offset, featured } = opts ?? {};
  const conditions = [eq(media.type, MediaType.GALLERY)];
  if (featured) conditions.push(eq(media.featured, true));
  const where = and(...conditions);

  const query = db
    .select({
      id: media.id,
      title: media.title,
      description: media.description,
      featured: media.featured,
      createdAt: media.createdAt,
      imageUrl: media.url,
      storageDriver: media.storageDriver,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt));
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);
  return query;
}

/** 按 id 查相册项 */
export async function getGalleryItemById(id: string): Promise<GalleryItemWithMedia | null> {
  const rows = await db
    .select({
      id: media.id,
      title: media.title,
      description: media.description,
      featured: media.featured,
      createdAt: media.createdAt,
      imageUrl: media.url,
      storageDriver: media.storageDriver,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(and(eq(media.id, id), eq(media.type, MediaType.GALLERY)))
    .limit(1);
  return rows[0] ?? null;
}

/** 创建相册项（直接在 media 表创建 type=GALLERY 的记录） */
export async function createGalleryItem(data: {
  url: string;
  storageDriver?: string;
  storageKey?: string | null;
  title?: string | null;
  description?: string | null;
  featured?: boolean;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedBy?: string | null;
}) {
  const rows = await db
    .insert(media)
    .values({
      type: MediaType.GALLERY,
      url: data.url,
      storageDriver: data.storageDriver ?? "LOCAL",
      storageKey: data.storageKey ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      featured: data.featured ?? false,
      mimeType: data.mimeType ?? null,
      size: data.size ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      uploadedBy: data.uploadedBy ?? null,
    })
    .returning();
  return rows[0];
}

/** 更新相册项（更新 media 表记录） */
export async function updateGalleryItem(
  id: string,
  data: {
    title?: string | null;
    description?: string | null;
    featured?: boolean;
  },
) {
  const rows = await db
    .update(media)
    .set(data)
    .where(and(eq(media.id, id), eq(media.type, MediaType.GALLERY)))
    .returning();
  return rows[0] ?? null;
}

/** 删除相册项（删除 media 表记录，关联标签自动级联删除） */
export async function deleteGalleryItem(id: string) {
  await db.delete(media).where(and(eq(media.id, id), eq(media.type, MediaType.GALLERY)));
}

/** search-index 元数据类型（T7 方案 A：全量轻量数据下发，前端筛选/搜索） */
export type GalleryMeta = {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  featured: boolean;
  createdAt: Date;
  tags: string[];
};

/**
 * 相册全量轻量元数据（含标签数组，按创建时间倒序）
 * - 博客低流量场景，全量下发（方案 A 纯客户端筛选/搜索）
 */
export async function listGalleryMeta(): Promise<GalleryMeta[]> {
  const rows = await db
    .select({
      id: media.id,
      title: media.title,
      description: media.description,
      imageUrl: media.url,
      featured: media.featured,
      createdAt: media.createdAt,
      tagName: tags.name,
    })
    .from(media)
    .leftJoin(mediaTags, eq(mediaTags.mediaId, media.id))
    .leftJoin(tags, eq(tags.id, mediaTags.tagId))
    .where(eq(media.type, MediaType.GALLERY))
    .orderBy(desc(media.createdAt));

  const map = new Map<string, GalleryMeta>();
  for (const r of rows) {
    let meta = map.get(r.id);
    if (!meta) {
      meta = {
        id: r.id,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        featured: r.featured,
        createdAt: r.createdAt,
        tags: [],
      };
      map.set(r.id, meta);
    }
    if (r.tagName) meta.tags.push(r.tagName);
  }
  return [...map.values()];
}

/** 给相册项添加标签（已存在则跳过） */
export async function addTagToGalleryItem(mediaId: string, tagId: string) {
  await db
    .insert(mediaTags)
    .values({ mediaId, tagId })
    .onConflictDoNothing();
}

/** 移除相册项的标签 */
export async function removeTagFromGalleryItem(mediaId: string, tagId: string) {
  await db
    .delete(mediaTags)
    .where(
      and(
        eq(mediaTags.mediaId, mediaId),
        eq(mediaTags.tagId, tagId),
      ),
    );
}

/** 设置相册项的标签（全量替换：先删后加） */
export async function setGalleryItemTags(mediaId: string, tagIds: string[]) {
  await db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));
  for (const tagId of tagIds) {
    await addTagToGalleryItem(mediaId, tagId);
  }
}

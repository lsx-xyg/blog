/**
 * 相册数据访问层（T5：列表/详情/CRUD；T7：全量轻量元数据 + 服务端过滤预留）
 *
 * 注意：gallery_items 表已重构，图片元数据（url/storage_driver/storage_key）
 * 统一在 media 表管理，gallery_items 只保留业务字段（title/description/featured）
 * + media_id 外键。查询时需要 join media 表获取图片 URL。
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { galleryItems, tags, galleryItemTags, media } from "@/db/schema";

/** 相册项（含 media 图片信息） */
export type GalleryItemWithMedia = {
  id: string;
  mediaId: string;
  title: string | null;
  description: string | null;
  featured: boolean;
  createdAt: Date;
  // media 表字段
  imageUrl: string;
  storageDriver: string;
  storageKey: string | null;
};

/** 相册列表（按创建时间倒序，支持分页） */
export async function listGalleryItems(opts?: {
  limit?: number;
  offset?: number;
  featured?: boolean;
}): Promise<GalleryItemWithMedia[]> {
  const { limit, offset, featured } = opts ?? {};
  const where = featured ? eq(galleryItems.featured, true) : undefined;
  const query = db
    .select({
      id: galleryItems.id,
      mediaId: galleryItems.mediaId,
      title: galleryItems.title,
      description: galleryItems.description,
      featured: galleryItems.featured,
      createdAt: galleryItems.createdAt,
      imageUrl: media.url,
      storageDriver: media.storageDriver,
      storageKey: media.storageKey,
    })
    .from(galleryItems)
    .innerJoin(media, eq(galleryItems.mediaId, media.id))
    .orderBy(desc(galleryItems.createdAt));
  if (where) query.where(where);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);
  return query;
}

/** 按 id 查相册项 */
export async function getGalleryItemById(id: string): Promise<GalleryItemWithMedia | null> {
  const rows = await db
    .select({
      id: galleryItems.id,
      mediaId: galleryItems.mediaId,
      title: galleryItems.title,
      description: galleryItems.description,
      featured: galleryItems.featured,
      createdAt: galleryItems.createdAt,
      imageUrl: media.url,
      storageDriver: media.storageDriver,
      storageKey: media.storageKey,
    })
    .from(galleryItems)
    .innerJoin(media, eq(galleryItems.mediaId, media.id))
    .where(eq(galleryItems.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 创建相册项（需要先在 media 表创建图片记录，然后传入 mediaId） */
export async function createGalleryItem(data: {
  mediaId: string;
  title?: string | null;
  description?: string | null;
  featured?: boolean;
}) {
  const rows = await db
    .insert(galleryItems)
    .values({
      mediaId: data.mediaId,
      title: data.title ?? null,
      description: data.description ?? null,
      featured: data.featured ?? false,
    })
    .returning();
  return rows[0];
}

/** 更新相册项 */
export async function updateGalleryItem(
  id: string,
  data: {
    title?: string | null;
    description?: string | null;
    featured?: boolean;
  },
) {
  const rows = await db
    .update(galleryItems)
    .set(data)
    .where(eq(galleryItems.id, id))
    .returning();
  return rows[0] ?? null;
}

/** 删除相册项（关联标签自动级联删除，media 记录不删除，由媒体库统一管理） */
export async function deleteGalleryItem(id: string) {
  await db.delete(galleryItems).where(eq(galleryItems.id, id));
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
      id: galleryItems.id,
      title: galleryItems.title,
      description: galleryItems.description,
      imageUrl: media.url,
      featured: galleryItems.featured,
      createdAt: galleryItems.createdAt,
      tagName: tags.name,
    })
    .from(galleryItems)
    .innerJoin(media, eq(galleryItems.mediaId, media.id))
    .leftJoin(galleryItemTags, eq(galleryItemTags.galleryItemId, galleryItems.id))
    .leftJoin(tags, eq(tags.id, galleryItemTags.tagId))
    .orderBy(desc(galleryItems.createdAt));

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
export async function addTagToGalleryItem(galleryItemId: string, tagId: string) {
  await db
    .insert(galleryItemTags)
    .values({ galleryItemId, tagId })
    .onConflictDoNothing();
}

/** 移除相册项的标签 */
export async function removeTagFromGalleryItem(galleryItemId: string, tagId: string) {
  await db
    .delete(galleryItemTags)
    .where(
      and(
        eq(galleryItemTags.galleryItemId, galleryItemId),
        eq(galleryItemTags.tagId, tagId),
      ),
    );
}

/** 设置相册项的标签（全量替换：先删后加） */
export async function setGalleryItemTags(galleryItemId: string, tagIds: string[]) {
  await db.delete(galleryItemTags).where(eq(galleryItemTags.galleryItemId, galleryItemId));
  for (const tagId of tagIds) {
    await addTagToGalleryItem(galleryItemId, tagId);
  }
}

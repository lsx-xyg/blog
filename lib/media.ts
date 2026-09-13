/**
 * 媒体库数据访问层（统一管理文章图片 + 相册图片）
 */
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, galleryItems, posts } from "@/db/schema";
import { MediaType, StorageDriverType } from "@/lib/types/media";

/** 创建媒体记录 */
export async function createMedia(data: {
  type: MediaType;
  url: string;
  storageDriver?: StorageDriverType | string;
  storageKey?: string | null;
  title?: string | null;
  description?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedBy?: string | null;
}) {
  const rows = await db
    .insert(media)
    .values({
      type: data.type,
      url: data.url,
      storageDriver: data.storageDriver ?? StorageDriverType.LOCAL,
      storageKey: data.storageKey ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      mimeType: data.mimeType ?? null,
      size: data.size ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      uploadedBy: data.uploadedBy ?? null,
    })
    .returning();
  return rows[0];
}

/** 按 id 查询媒体 */
export async function getMediaById(id: string) {
  const rows = await db
    .select()
    .from(media)
    .where(eq(media.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 媒体列表（支持按类型筛选、搜索、分页） */
export async function listMedia(opts?: {
  type?: MediaType;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { type, search, limit, offset } = opts ?? {};

  const conditions = [];
  if (type) conditions.push(eq(media.type, type));
  if (search) {
    conditions.push(
      or(
        ilike(media.title, `%${search}%`),
        ilike(media.description, `%${search}%`),
        ilike(media.url, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select({
      id: media.id,
      type: media.type,
      url: media.url,
      storageDriver: media.storageDriver,
      storageKey: media.storageKey,
      title: media.title,
      description: media.description,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width,
      height: media.height,
      uploadedBy: media.uploadedBy,
      createdAt: media.createdAt,
      featured: galleryItems.featured, // 相册精选状态（leftJoin，非相册为 null）
    })
    .from(media)
    .leftJoin(galleryItems, eq(galleryItems.mediaId, media.id))
    .orderBy(desc(media.createdAt));

  if (where) query.where(where);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);

  return query;
}

/** 统计媒体数量 */
export async function countMedia(opts?: { type?: MediaType; search?: string }) {
  const { type, search } = opts ?? {};

  const conditions = [];
  if (type) conditions.push(eq(media.type, type));
  if (search) {
    conditions.push(
      or(
        ilike(media.title, `%${search}%`),
        ilike(media.description, `%${search}%`),
        ilike(media.url, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(media)
    .where(where ?? sql`true`);

  return Number(result[0]?.count ?? 0);
}

/** 更新媒体记录 */
export async function updateMedia(
  id: string,
  data: {
    type?: MediaType;
    title?: string | null;
    description?: string | null;
  },
) {
  const rows = await db
    .update(media)
    .set(data)
    .where(eq(media.id, id))
    .returning();
  return rows[0] ?? null;
}

/** 删除媒体记录（同时删除存储中的文件） */
export async function deleteMedia(id: string) {
  const item = await getMediaById(id);
  if (!item) return false;

  // 删除数据库记录
  await db.delete(media).where(eq(media.id, id));

  // 注意：存储中的文件删除由调用方处理（需要根据 storageDriver 选择对应驱动）
  return { item };
}

/**
 * 查找未使用的图片（不在文章内容中，也不在相册中）
 *
 * 逻辑：
 * 1. 获取所有媒体的 URL
 * 2. 获取所有已发布文章的内容，检查哪些 URL 被引用
 * 3. 获取所有相册项的 imageUrl，检查哪些 URL 被引用
 * 4. 未被引用的就是未使用的图片
 */
export async function findUnusedMedia() {
  // 获取所有媒体
  const allMedia = await db.select().from(media).orderBy(desc(media.createdAt));

  // 获取所有已发布文章的内容
  const allPosts = await db
    .select({ content: posts.content })
    .from(posts)
    .where(eq(posts.status, "PUBLISHED"));

  // 获取所有相册项关联的 media.url
  const allGallery = await db
    .select({ imageUrl: media.url })
    .from(galleryItems)
    .innerJoin(media, eq(galleryItems.mediaId, media.id));

  // 合并所有被引用的 URL
  const usedUrls = new Set<string>();

  // 从文章内容中提取图片 URL（Markdown 格式 ![alt](url) 和 HTML <img src="url">）
  for (const post of allPosts) {
    if (!post.content) continue;
    // 匹配 Markdown 图片
    const mdMatches = post.content.match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];
    for (const match of mdMatches) {
      const url = match.replace(/!\[[^\]]*\]\(([^)]+)\)/, "$1");
      usedUrls.add(url);
    }
    // 匹配 HTML img
    const htmlMatches = post.content.match(/<img[^>]+src=["']([^"']+)["']/g) || [];
    for (const match of htmlMatches) {
      const url = match.replace(/<img[^>]+src=["']([^"']+)["']/, "$1");
      usedUrls.add(url);
    }
  }

  // 从相册中提取 URL
  for (const item of allGallery) {
    if (item.imageUrl) usedUrls.add(item.imageUrl);
  }

  // 过滤未使用的媒体
  const unusedMedia = allMedia.filter((m) => !usedUrls.has(m.url));

  return unusedMedia;
}

/** 批量删除媒体 */
export async function batchDeleteMedia(ids: string[]) {
  if (ids.length === 0) return [];
  const items = await db
    .select()
    .from(media)
    .where(inArray(media.id, ids));

  await db.delete(media).where(inArray(media.id, ids));

  return items;
}

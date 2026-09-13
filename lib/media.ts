/**
 * 媒体库数据访问层（统一管理文章图片 + 相册图片）
 */
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, posts, mediaTags, tags } from "@/db/schema";
import { MediaType, StorageDriverType } from "@/lib/types/media";
import { getOrCreateTags } from "@/lib/tags";

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
  featured?: boolean;
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
      featured: data.featured ?? false,
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
    .select()
    .from(media)
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
    featured?: boolean;
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
 * 查找未使用的图片（不在文章内容中）
 *
 * 逻辑：
 * 1. 获取所有媒体的 URL
 * 2. 获取所有已发布文章的内容，检查哪些 URL 被引用
 * 3. 相册图片（type=GALLERY）默认就是被使用的，不需要检查
 * 4. 文章图片（type=ARTICLE）未被文章内容引用的就是未使用的图片
 */
export async function findUnusedMedia() {
  // 获取所有媒体
  const allMedia = await db.select().from(media).orderBy(desc(media.createdAt));

  // 获取所有已发布文章的内容
  const allPosts = await db
    .select({ content: posts.content })
    .from(posts)
    .where(eq(posts.status, "PUBLISHED"));

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

  // 过滤未使用的媒体：
  // - 相册图片（type=GALLERY）默认就是被使用的
  // - 文章图片（type=ARTICLE）未被文章内容引用的就是未使用的
  const unusedMedia = allMedia.filter(
    (m) => m.type !== MediaType.GALLERY && !usedUrls.has(m.url),
  );

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

/** 获取媒体的标签列表 */
export async function getMediaTags(mediaId: string) {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(mediaTags)
    .innerJoin(tags, eq(tags.id, mediaTags.tagId))
    .where(eq(mediaTags.mediaId, mediaId))
    .orderBy(tags.name);
  return rows;
}

/** 设置媒体的标签（全量替换，自动创建不存在的标签） */
export async function setMediaTags(mediaId: string, tagNames: string[]) {
  // 先删除旧的关联
  await db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));

  // 获取或创建标签
  const tagIds = await getOrCreateTags(tagNames);

  // 插入新的关联
  for (const tagId of tagIds) {
    await db
      .insert(mediaTags)
      .values({ mediaId, tagId })
      .onConflictDoNothing();
  }

  return getMediaTags(mediaId);
}

/**
 * 媒体库数据访问层（统一管理文章图片 + 相册图片）
 */
import { and, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { media, posts, mediaTags, tags } from '@/db/schema';
import { MediaType } from '@/lib/types/media';
import { StorageDriverType } from '@/lib/types/storage';
import { getOrCreateTags } from '@/lib/tags/server';
import { extractImageUrls, urlToPathKey } from './url-refs';

/** 创建媒体记录 */
export async function createMedia(data: {
  type: MediaType;
  url: string;
  storageDriver?: StorageDriverType;
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
  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * 媒体列表（支持按类型筛选、搜索、分页）
 *
 * 类型隔离约定（明确写条件，不靠默认）：
 * - 显式传 type（ARTICLE/GALLERY）→ 按该类型查询
 * - 未传 type → **排除 VIDEO_POSTER**（视频封面只服务 videos.posterMediaId，
 *   不参与图片 Tab 与 media-picker 列表）
 */
export async function listMedia(opts?: {
  type?: MediaType;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { type, search, limit, offset } = opts ?? {};

  const conditions = [];
  if (type) conditions.push(eq(media.type, type));
  else conditions.push(ne(media.type, MediaType.VIDEO_POSTER));
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

  const query = db.select().from(media).orderBy(desc(media.createdAt));

  if (where) query.where(where);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);

  return query;
}

/** 统计媒体数量（同样隔离 VIDEO_POSTER） */
export async function countMedia(opts?: { type?: MediaType; search?: string }) {
  const { type, search } = opts ?? {};

  const conditions = [];
  if (type) conditions.push(eq(media.type, type));
  else conditions.push(ne(media.type, MediaType.VIDEO_POSTER));
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
  const rows = await db.update(media).set(data).where(eq(media.id, id)).returning();
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
 * 封面 URL 规范化：把封面统一存为媒体库相对路径（/m/xxx）
 *
 * 背景：media.url 存相对路径，而历史上封面可能被存成 CDN 直链
 * （https://cdn.jsdelivr.net/gh/.../assets/2026/09/xxx.jpg），两种前缀
 * 体系不一致，导致「未使用图片」清理时封面图被误判为未使用。
 * 从源头统一：写入 coverUrl 前按文件名（媒体库 hash 文件名唯一）匹配
 * media 表，命中则改用 media.url（/m/xxx）；未命中（外部图床）保留原值。
 */
export async function normalizeCoverUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return url ?? null;
  let fileName: string | undefined;
  try {
    fileName = new URL(url, 'http://local').pathname.split('/').pop();
  } catch {
    fileName = url.split('/').pop();
  }
  if (!fileName || !fileName.includes('.')) return url;
  const rows = await db
    .select({ mediaUrl: media.url })
    .from(media)
    .where(ilike(media.url, `%${fileName}`))
    .limit(1);
  return rows[0]?.mediaUrl ?? url;
}

/**
 * 查找未使用的图片（不在文章内容与封面中）
 *
 * 逻辑：
 * 1. 获取所有媒体的 URL
 * 2. 获取所有文章（含草稿）的内容与封面，检查哪些图片 URL 被引用
 * 3. 相册图片（type=GALLERY）默认就是被使用的，不需要检查
 * 4. 文章图片（type=ARTICLE）未被文章内容/封面引用的就是未使用的图片
 *
 * 注意：media.url 为相对路径、posts.coverUrl 为 CDN 直链（前缀体系不同），
 * 必须经 urlToPathKey 归一化后比较，否则封面图会被误判为未使用。
 */
export async function findUnusedMedia() {
  // 获取所有媒体
  const allMedia = await db.select().from(media).orderBy(desc(media.createdAt));

  // 获取所有文章的内容与封面（草稿封面同样算引用：清理后发布时封面会丢）
  const allPosts = await db
    .select({ content: posts.content, coverUrl: posts.coverUrl })
    .from(posts);

  // 合并所有被引用的 URL（归一化键）
  const usedKeys = new Set<string>();

  // 从文章内容提取图片 URL（Markdown ![alt](url) 与 HTML <img src="url">）
  for (const post of allPosts) {
    if (post.content) {
      for (const url of extractImageUrls(post.content)) {
        usedKeys.add(urlToPathKey(url));
      }
    }
    // 文章封面图（CDN 直链，与 media.url 不同前缀，靠归一化键匹配）
    if (post.coverUrl) {
      usedKeys.add(urlToPathKey(post.coverUrl));
    }
  }

  // 过滤未使用的媒体：
  // - 相册图片（type=GALLERY）默认就是被使用的
  // - 视频封面（type=VIDEO_POSTER）不参与清理（删除由视频删除流程联动处理，这里是兜底）
  // - 文章图片（type=ARTICLE）未被文章内容/封面引用的就是未使用的
  const unusedMedia = allMedia.filter(
    (m) =>
      m.type !== MediaType.GALLERY &&
      m.type !== MediaType.VIDEO_POSTER &&
      !usedKeys.has(urlToPathKey(m.url)),
  );

  return unusedMedia;
}

/**
 * 判断媒体是否被文章引用（删除联动用）
 *
 * 视频删除时若封面（posterMediaId 指向的 media）未被任何文章引用，
 * 则连同封面 media 记录与封面文件一起删除；被引用则跳过。
 * （VIDEO_POSTER 封面一般不会被文章插入，但引用检查不能省——用户可能在文章里手动贴过这张图）
 * 引用来源：文章正文图片 + 文章封面（coverUrl），按归一化键匹配。
 */
export async function isMediaReferenced(mediaId: string): Promise<boolean> {
  const item = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  const record = item[0];
  if (!record || !record.url) return false;

  const key = urlToPathKey(record.url);
  const rows = await db.select({ content: posts.content, coverUrl: posts.coverUrl }).from(posts);

  return rows.some((post) => {
    if (post.coverUrl && urlToPathKey(post.coverUrl) === key) return true;
    if (post.content) {
      for (const url of extractImageUrls(post.content)) {
        if (urlToPathKey(url) === key) return true;
      }
    }
    return false;
  });
}

/** 批量删除媒体 */
export async function batchDeleteMedia(ids: string[]) {
  if (ids.length === 0) return [];
  const items = await db.select().from(media).where(inArray(media.id, ids));

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
    await db.insert(mediaTags).values({ mediaId, tagId }).onConflictDoNothing();
  }

  return getMediaTags(mediaId);
}

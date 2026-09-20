/**
 * 文章数据访问层（T4：列表/详情/浏览量；T7：全量轻量元数据 + 服务端过滤预留）
 */
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { posts, tags, postTags } from '@/db/schema';
import { getOrCreateTags } from '@/lib/tags/server';
import { PostMeta, PostStatus } from '@/lib/types/posts';

/** 数据库事务类型（用于 setPostTags 支持在事务内执行，与文章创建/更新原子提交） */
type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 已发布文章列表（按发布时间倒序，publishedAt 为空用 createdAt 兜底；支持分页） */
export async function listPublishedPosts(opts?: { limit?: number; offset?: number }) {
  const { limit, offset } = opts ?? {};
  const query = db
    .select()
    .from(posts)
    .where(eq(posts.status, PostStatus.PUBLISHED))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);
  return query;
}

/** 按 slug 或 id（slug 留空时用 ID 兜底）查已发布文章 */
export async function getPublishedPostBySlugOrId(slugOrId: string) {
  // 非 uuid 参数只匹配 slug，避免 PG 对 uuid 列做非法类型转换（22P02）
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, PostStatus.PUBLISHED),
        isUuid ? or(eq(posts.slug, slugOrId), eq(posts.id, slugOrId)) : eq(posts.slug, slugOrId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** 后台：全部文章（含草稿/定时），最新在前，附带标签名数组 */
export async function listAllPosts() {
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      summary: posts.summary,
      content: posts.content,
      status: posts.status,
      featured: posts.featured,
      coverUrl: posts.coverUrl,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      tagName: tags.name,
    })
    .from(posts)
    .leftJoin(postTags, eq(postTags.postId, posts.id))
    .leftJoin(tags, eq(tags.id, postTags.tagId))
    .orderBy(desc(posts.createdAt));

  const map = new Map<string, Omit<(typeof rows)[number], 'tagName'> & { tags: string[] }>();
  for (const r of rows) {
    let item = map.get(r.id);
    if (!item) {
      const { tagName: _t, ...rest } = r;
      item = { ...rest, tags: [] };
      map.set(r.id, item);
    }
    if (r.tagName) item.tags.push(r.tagName);
  }
  return [...map.values()];
}

/** 后台：按 ID 获取文章（含草稿/定时，用于编辑），附带标签名数组 */
export async function getPostById(id: string) {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  const post = rows[0];
  if (!post) return null;
  const tagNames = await getPostTags(id);
  return { ...post, tags: tagNames };
}

/** 按文章 ID 获取标签名列表（按名称排序） */
export async function getPostTags(postId: string) {
  const rows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId))
    .orderBy(tags.name);
  return rows.map((r) => r.name);
}

/**
 * 设置文章标签（全量替换，自动创建不存在的标签）
 *
 * 说明：
 * - post_tags 关联的删除/插入使用传入的事务（与文章创建/更新原子提交）
 * - 标签本身的创建（getOrCreateTags）走全局连接、幂等可重试，失败不影响文章数据
 */
export async function setPostTags(postId: string, tagNames: string[], tx?: PgTx) {
  const client = tx ?? db;

  // 先删除旧的关联
  await client.delete(postTags).where(eq(postTags.postId, postId));

  // 获取或创建标签（返回标签 ID 数组）
  const tagIds = await getOrCreateTags(tagNames);

  // 插入新的关联
  for (const tagId of tagIds) {
    await client.insert(postTags).values({ postId, tagId }).onConflictDoNothing();
  }
}

/** 浏览量 +1（原子自增，防并发覆盖） */
export async function incrementViewCount(id: string) {
  return db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, viewCount: posts.viewCount });
}

/**
 * 已发布文章全量轻量元数据（含标签数组，按发布时间倒序）
 * - 博客低流量场景，全量下发（方案 A 纯客户端筛选/搜索）
 */
export async function listPublishedPostMeta(): Promise<PostMeta[]> {
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      summary: posts.summary,
      coverUrl: posts.coverUrl,
      featured: posts.featured,
      createdAt: posts.createdAt,
      publishedAt: posts.publishedAt,
      tagName: tags.name,
    })
    .from(posts)
    .leftJoin(postTags, eq(postTags.postId, posts.id))
    .leftJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(posts.status, PostStatus.PUBLISHED))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);

  const map = new Map<string, PostMeta>();
  for (const r of rows) {
    let meta = map.get(r.id);
    if (!meta) {
      meta = {
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        coverUrl: r.coverUrl,
        featured: r.featured,
        createdAt: r.createdAt,
        publishedAt: r.publishedAt,
        tags: [],
      };
      map.set(r.id, meta);
    }
    if (r.tagName) meta.tags.push(r.tagName);
  }
  return [...map.values()];
}

/**
 * 服务端过滤（SEARCH_MODE=DATABASE 预留，T7 开关）：
 * 标签多选（AND 语义，需全部命中）/ 仅精选 / 关键词（标题+摘要+标签）
 */
export async function listPublishedPostsFiltered(opts?: {
  limit?: number;
  offset?: number;
  tags?: string[];
  featured?: boolean;
  query?: string;
}) {
  const { limit, offset, tags: tagNames, featured, query } = opts ?? {};
  const where = [eq(posts.status, PostStatus.PUBLISHED)];
  if (featured) where.push(eq(posts.featured, true));
  if (query?.trim()) {
    const q = `%${query.trim()}%`;
    where.push(
      sql`(${posts.title} ilike ${q} or ${posts.summary} ilike ${q} or exists (select 1 from ${postTags} pt join ${tags} t on t.id = pt.tag_id where pt.post_id = ${posts.id} and t.name ilike ${q}))`,
    );
  }
  if (tagNames?.length) {
    // OR 语义：命中任一标签即匹配（与前端方案 A 一致）
    where.push(
      sql`(${sql.join(
        tagNames.map(
          (name) =>
            sql`exists (select 1 from ${postTags} pt join ${tags} t on t.id = pt.tag_id where pt.post_id = ${posts.id} and t.name = ${name})`,
        ),
        sql.raw(' or '),
      )})`,
    );
  }
  const queryBuilder = db
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
  if (limit != null) queryBuilder.limit(limit);
  if (offset != null) queryBuilder.offset(offset);
  return queryBuilder;
}

/** sitemap 用：所有已发布文章的轻量元数据（id/slug/时间戳） */
export async function getAllPostsForSitemap() {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.status, PostStatus.PUBLISHED))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
}

/**
 * T12 定时发布：扫描并发布到期的定时文章
 *
 * 幂等设计：
 * - 只扫描 status = SCHEDULED 且 scheduledAt <= now 的文章
 * - 发布后 status → PUBLISHED，publishedAt → now
 * - 已发布的文章不会重复发布（因为 status 已经是 PUBLISHED）
 * - 使用双重检查（WHERE status = SCHEDULED）防止并发重复发布
 *
 * 注意：此函数只负责数据库操作，缓存失效（revalidatePath）由调用方处理
 *
 * @returns 发布的文章列表（id + slug），用于调用方失效缓存
 */
export async function publishScheduledPosts(): Promise<Array<{ id: string; slug: string | null }>> {
  const now = new Date();
  const nowIso = now.toISOString();

  // 查找所有到期的定时文章
  // 注意：postgres.js 在 sql 模板中处理 Date 对象可能出错，需要转成 ISO 字符串
  const scheduledPosts = await db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.status, PostStatus.SCHEDULED), sql`${posts.scheduledAt} <= ${nowIso}`));

  if (scheduledPosts.length === 0) {
    return [];
  }

  // 批量发布（使用双重检查防止并发重复发布）
  const published: Array<{ id: string; slug: string | null }> = [];
  for (const post of scheduledPosts) {
    const [updated] = await db
      .update(posts)
      .set({
        status: PostStatus.PUBLISHED,
        publishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(posts.id, post.id),
          eq(posts.status, PostStatus.SCHEDULED), // 双重检查，防止并发重复发布
        ),
      )
      .returning({ id: posts.id });

    if (Array.isArray(updated) && updated.length > 0) {
      published.push(post);
    }
  }

  return published;
}

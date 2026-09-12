/**
 * 文章数据访问层（T4：列表/详情/浏览量；T7：全量轻量元数据 + 服务端过滤预留）
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts, tags, postTags } from "@/db/schema";

/** 已发布文章列表（按发布时间倒序，publishedAt 为空用 createdAt 兜底；支持分页） */
export async function listPublishedPosts(opts?: {
  limit?: number;
  offset?: number;
}) {
  const { limit, offset } = opts ?? {};
  const query = db
    .select()
    .from(posts)
    .where(eq(posts.status, "PUBLISHED"))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
  if (limit != null) query.limit(limit);
  if (offset != null) query.offset(offset);
  return query;
}

/** 按 slug 或 id（slug 留空时用 ID 兜底）查已发布文章 */
export async function getPublishedPostBySlugOrId(slugOrId: string) {
  // 非 uuid 参数只匹配 slug，避免 PG 对 uuid 列做非法类型转换（22P02）
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slugOrId,
    );
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "PUBLISHED"),
        isUuid
          ? or(eq(posts.slug, slugOrId), eq(posts.id, slugOrId))
          : eq(posts.slug, slugOrId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** 后台：全部文章（含草稿/定时），最新在前 */
export async function listAllPosts() {
  return db.select().from(posts).orderBy(desc(posts.createdAt));
}

/** 浏览量 +1（原子自增，防并发覆盖） */
export async function incrementViewCount(id: string) {
  return db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, viewCount: posts.viewCount });
}

/** search-index 元数据类型（T7 方案 A：全量轻量数据下发，前端筛选/搜索） */
export type PostMeta = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  featured: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  tags: string[];
};

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
    .where(eq(posts.status, "PUBLISHED"))
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
  const where = [eq(posts.status, "PUBLISHED")];
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
          (name) => sql`exists (select 1 from ${postTags} pt join ${tags} t on t.id = pt.tag_id where pt.post_id = ${posts.id} and t.name = ${name})`,
        ),
        sql.raw(" or "),
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
    .where(eq(posts.status, "PUBLISHED"))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
}

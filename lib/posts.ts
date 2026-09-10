/**
 * 文章数据访问层（T4：列表/详情/浏览量；T6 扩展标签关联）
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

/** 已发布文章列表（按发布时间倒序，publishedAt 为空用 createdAt 兜底） */
export async function listPublishedPosts() {
  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "PUBLISHED"))
    .orderBy(sql`coalesce(${posts.publishedAt}, ${posts.createdAt}) desc`);
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

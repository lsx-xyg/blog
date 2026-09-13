/**
 * 标签数据访问层（全局标签表，文章 + 相册共用）
 */
import { eq, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { tags, postTags, mediaTags } from "@/db/schema";

/** 按名称查找标签 */
export async function getTagByName(name: string) {
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  return rows[0] ?? null;
}

/** 创建标签（slug 由 name 自动生成，冲突加后缀） */
export async function createTag(name: string) {
  // 生成 slug：小写 + 连字符
  let slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");

  // 检查 slug 冲突，冲突加后缀
  let suffix = 1;
  const baseSlug = slug;
  while (true) {
    const existing = await db
      .select()
      .from(tags)
      .where(eq(tags.slug, slug))
      .limit(1);
    if (existing.length === 0) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const rows = await db
    .insert(tags)
    .values({ name, slug })
    .returning();
  return rows[0];
}

/**
 * 批量获取或创建标签
 * 输入标签名称数组，返回标签 ID 数组
 * 已存在的标签直接返回 ID，不存在的自动创建
 */
export async function getOrCreateTags(names: string[]): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    let tag = await getTagByName(trimmed);
    if (!tag) {
      tag = await createTag(trimmed);
    }
    tagIds.push(tag.id);
  }

  return tagIds;
}

/** 全部标签列表（按名称排序） */
export async function listAllTags() {
  return db.select().from(tags).orderBy(tags.name);
}

/** 按 ID 列表查找标签 */
export async function getTagsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(tags).where(inArray(tags.id, ids));
}

/** 按 ID 查找单个标签 */
export async function getTagById(id: string) {
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 删除标签（关联的文章/相册标签由外键 CASCADE 清理） */
export async function deleteTag(id: string) {
  await db.delete(tags).where(eq(tags.id, id));
}

/** 标签列表（含关联的文章数和图片数，按总使用数倒序） */
export async function listTagsWithCount() {
  const postCountExpr = sql<number>`coalesce((
    SELECT COUNT(*) FROM ${postTags} WHERE ${postTags.tagId} = ${tags.id}
  ), 0)`;
  const mediaCountExpr = sql<number>`coalesce((
    SELECT COUNT(*) FROM ${mediaTags} WHERE ${mediaTags.tagId} = ${tags.id}
  ), 0)`;

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
      postCount: postCountExpr,
      mediaCount: mediaCountExpr,
    })
    .from(tags)
    .orderBy(desc(sql`${postCountExpr} + ${mediaCountExpr}`), tags.name);

  return rows.map((row) => ({
    ...row,
    postCount: Number(row.postCount),
    mediaCount: Number(row.mediaCount),
    totalCount: Number(row.postCount) + Number(row.mediaCount),
  }));
}

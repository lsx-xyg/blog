/**
 * 友链数据访问层（friend_links 表）
 */
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { friendLinks } from "@/db/schema";

export type NewFriendLink = typeof friendLinks.$inferInsert;
export type FriendLink = typeof friendLinks.$inferSelect;

/** 获取所有友链（按 sort_order 排序） */
export async function listFriendLinks(): Promise<FriendLink[]> {
  return db.select().from(friendLinks).orderBy(asc(friendLinks.sortOrder), asc(friendLinks.createdAt));
}

/** 按 ID 获取友链 */
export async function getFriendLinkById(id: string): Promise<FriendLink | null> {
  const rows = await db
    .select()
    .from(friendLinks)
    .where(eq(friendLinks.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 创建友链 */
export async function createFriendLink(data: NewFriendLink): Promise<FriendLink> {
  const rows = await db.insert(friendLinks).values(data).returning();
  return rows[0];
}

/** 更新友链 */
export async function updateFriendLink(
  id: string,
  data: Partial<NewFriendLink>,
): Promise<FriendLink | null> {
  const rows = await db
    .update(friendLinks)
    .set(data)
    .where(eq(friendLinks.id, id))
    .returning();
  return rows[0] ?? null;
}

/** 删除友链 */
export async function deleteFriendLink(id: string): Promise<void> {
  await db.delete(friendLinks).where(eq(friendLinks.id, id));
}

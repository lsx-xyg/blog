/**
 * 数据库 schema（SPEC §4）
 * - 9 张业务表 + Better Auth 4 张核心表（user/session/account/verification）
 * - 枚举值全大写（post_status / backup_trigger）
 * - 标签 name 原样存储（大小写敏感），slug 唯一冲突加后缀
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------- 枚举（全大写） ---------- */

export const postStatus = pgEnum("post_status", [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
]);

export const backupTrigger = pgEnum("backup_trigger", ["MANUAL", "AUTO"]);

/* ---------- Better Auth 核心表（列名 camelCase，与适配器对齐；user 表扩展 isAdmin） ---------- */

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAdmin: boolean("isAdmin").notNull().default(false), // SPEC §4.1 扩展
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- posts 文章表（SPEC §4.2） ---------- */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug"), // URL 别名，留空用 ID 兜底（null 可多条）
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content").notNull(), // Markdown 原文
    coverUrl: text("cover_url"),
    status: postStatus("status").notNull().default("DRAFT"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    featured: boolean("featured").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("posts_slug_idx").on(t.slug),
    index("posts_status_idx").on(t.status),
    index("posts_scheduled_at_idx").on(t.scheduledAt),
    index("posts_featured_idx").on(t.featured),
  ],
);

/* ---------- tags 全局标签表（SPEC §4.3，文章+相册共用） ---------- */

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(), // 原样存储，大小写敏感
    slug: text("slug").notNull().unique(), // 由 name 生成，冲突加后缀
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_name_idx").on(t.name), uniqueIndex("tags_slug_idx").on(t.slug)],
);

/* ---------- post_tags 关联表（SPEC §4.4） ---------- */

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_id_idx").on(t.tagId),
  ],
);

/* ---------- gallery_items 相册表（SPEC §4.5） ---------- */

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title"),
    description: text("description"),
    featured: boolean("featured").notNull().default(false),
    imageUrl: text("image_url").notNull(), // 存储抽象返回的公开 URL
    storageDriver: text("storage_driver").notNull().default("LOCAL"), // 上传平台：LOCAL|GITHUB|S3
    storageKey: text("storage_key"), // 存储键（用于删除，如 2026/09/uuid.jpg）
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gallery_items_featured_idx").on(t.featured)],
);

/* ---------- gallery_item_tags 关联表（SPEC §4.6） ---------- */

export const galleryItemTags = pgTable(
  "gallery_item_tags",
  {
    galleryItemId: uuid("gallery_item_id")
      .notNull()
      .references(() => galleryItems.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.galleryItemId, t.tagId] }),
    index("gallery_item_tags_tag_id_idx").on(t.tagId),
  ],
);

/* ---------- settings 键值配置表（SPEC §4.7） ---------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/* ---------- friend_links 友链表（SPEC §4.8） ---------- */

export const friendLinks = pgTable(
  "friend_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    avatarUrl: text("avatar_url"),
    description: text("description").notNull().default(""),
    tags: text("tags").array().notNull().default([]), // 标签直接存数组
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("friend_links_sort_idx").on(t.sortOrder)],
);

/* ---------- backup_records 备份记录表（SPEC §4.9） ---------- */

export const backupRecords = pgTable("backup_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileKey: text("file_key").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  triggeredBy: backupTrigger("triggered_by").notNull().default("MANUAL"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- 类型导出（M2+ 使用） ---------- */
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type FriendLink = typeof friendLinks.$inferSelect;
export type BackupRecord = typeof backupRecords.$inferSelect;
export type User = typeof users.$inferSelect;

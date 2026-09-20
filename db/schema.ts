/**
 * 数据库 schema（SPEC §4）
 * - 9 张业务表 + Better Auth 4 张核心表（user/session/account/verification）
 * - 枚举值全大写（post_status / backup_trigger）
 * - 标签 name 原样存储（大小写敏感），slug 唯一冲突加后缀
 */
import { BackupTrigger, BackupAuditAction } from '@/lib/types/backup';
import { GuideProgressStatus, GuideStatus } from '@/lib/types/guides';
import type { GuideStep, GuideTargetCondition } from '@/lib/types/guides';
import { MediaType } from '@/lib/types/media';
import { PostStatus } from '@/lib/types/posts';
import { StorageDriverType } from '@/lib/types/storage';
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
} from 'drizzle-orm/pg-core';

/* ---------- 枚举（全大写） ---------- */

export const postStatus = pgEnum('post_status', PostStatus);

export const backupTrigger = pgEnum('backup_trigger', BackupTrigger);

export const mediaType = pgEnum('media_type', MediaType);

export const storageDriverType = pgEnum('storage_driver', StorageDriverType);

export const backupAuditAction = pgEnum('backup_audit_action', BackupAuditAction);

export const guideStatus = pgEnum('guide_status', GuideStatus);

export const guideProgressStatus = pgEnum('guide_progress_status', GuideProgressStatus);

/* ---------- Better Auth 核心表（列名 camelCase，与适配器对齐；user 表扩展 isAdmin） ---------- */

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  isAdmin: boolean('isAdmin').notNull().default(false), // SPEC §4.1 扩展
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- posts 文章表（SPEC §4.2） ---------- */

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug'), // URL 别名，留空用 ID 兜底（null 可多条）
    title: text('title').notNull(),
    summary: text('summary'),
    content: text('content').notNull(), // Markdown 原文
    coverUrl: text('cover_url'),
    status: postStatus('status').notNull().default(PostStatus.DRAFT),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    featured: boolean('featured').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('posts_slug_idx').on(t.slug),
    index('posts_status_idx').on(t.status),
    index('posts_scheduled_at_idx').on(t.scheduledAt),
    index('posts_featured_idx').on(t.featured),
  ],
);

/* ---------- tags 全局标签表（SPEC §4.3，文章+相册共用） ---------- */

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // 原样存储，大小写敏感
    slug: text('slug').notNull().unique(), // 由 name 生成，冲突加后缀
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_name_idx').on(t.name), uniqueIndex('tags_slug_idx').on(t.slug)],
);

/* ---------- post_tags 关联表（SPEC §4.4） ---------- */

export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index('post_tags_tag_id_idx').on(t.tagId)],
);

/* ---------- media 媒体库表（统一管理文章图片 + 相册图片） ---------- */

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: mediaType('type').notNull(), // ARTICLE | GALLERY（枚举，禁止硬编码）
    url: text('url').notNull(), // 访问 URL（存储驱动返回的公开 URL）
    storageDriver: storageDriverType('storage_driver').notNull().default(StorageDriverType.LOCAL), // LOCAL | GITHUB | S3
    storageKey: text('storage_key'), // 存储键（用于删除，如 2026/09/uuid.jpg）
    title: text('title'), // 可空
    description: text('description'), // 可空
    mimeType: text('mime_type'), // MIME 类型，如 image/jpeg
    size: integer('size'), // 文件大小（字节）
    width: integer('width'), // 图片宽度（可空）
    height: integer('height'), // 图片高度（可空）
    featured: boolean('featured').notNull().default(false), // 相册图片是否精选（ARTICLE 类型无意义）
    uploadedBy: text('uploaded_by'), // 上传者 user_id（Better Auth 用 text 类型 id，可空）
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_type_idx').on(t.type),
    index('media_storage_driver_idx').on(t.storageDriver),
    index('media_created_at_idx').on(t.createdAt),
    index('media_featured_idx').on(t.featured),
  ],
);

/* ---------- media_tags 关联表（媒体-标签，替代原 gallery_item_tags） ---------- */

export const mediaTags = pgTable(
  'media_tags',
  {
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.tagId] }),
    index('media_tags_tag_id_idx').on(t.tagId),
  ],
);

/* ---------- settings 键值配置表（SPEC §4.7） ---------- */

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

/* ---------- friend_links 友链表（SPEC §4.8） ---------- */

export const friendLinks = pgTable(
  'friend_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    avatarUrl: text('avatar_url'),
    description: text('description').notNull().default(''),
    tags: text('tags').array().notNull().default([]), // 标签直接存数组
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('friend_links_sort_idx').on(t.sortOrder)],
);

/* ---------- backup_records 备份记录表（SPEC §4.9） ---------- */

export const backupRecords = pgTable('backup_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileKey: text('file_key').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  triggeredBy: backupTrigger('triggered_by').notNull().default('MANUAL'),
  // 备份创建时使用的存储驱动（GITHUB/S3/LOCAL）
  // 用于切换驱动后仍能正确下载/删除旧备份
  // null 表示未知，回退到当前配置的私有存储驱动
  storageDriver: storageDriverType('storage_driver'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- backup_audit_logs 备份审计日志表 ---------- */

export const backupAuditLogs = pgTable(
  'backup_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 关联的备份记录 ID（备份被删除后仍保留日志，所以允许为 null）
    backupId: uuid('backup_id'),
    // 备份文件的 key（冗余存储，方便查询已删除的备份）
    fileKey: text('file_key').notNull(),
    // 操作类型（CREATE/DOWNLOAD/DELETE/RESTORE）
    action: backupAuditAction('action').notNull(),
    // 操作人 ID（未登录操作为 null）
    userId: text('user_id'),
    // 操作人 IP 地址
    ipAddress: text('ip_address'),
    // 操作人 User-Agent
    userAgent: text('user_agent'),
    // 操作时间
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    backupIdx: index('backup_audit_backup_idx').on(table.backupId),
    actionIdx: index('backup_audit_action_idx').on(table.action),
    createdAtIdx: index('backup_audit_created_at_idx').on(table.createdAt),
  }),
);

/* ---------- guiders 引导配置表（Onboarding Guide） ---------- */

export const guiders = pgTable(
  'guiders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 唯一标识，带版本号（如 reveal_password_setup_v1），改版换 key 老用户重新触发 */
    guideKey: text('guide_key').notNull().unique(),
    title: text('title').notNull(),
    /** 适用路由（如 /settings），前端按页面过滤 */
    page: text('page').notNull(),
    /** 步骤数组 [{id,target,title,content,placement}] */
    steps: jsonb('steps').notNull().$type<GuideStep[]>(),
    /** draft / published / archived */
    status: guideStatus('status').notNull().default(GuideStatus.DRAFT),
    /** 触发条件 {event,page}，行为 + 页面组合 */
    targetCondition: jsonb('target_condition').$type<GuideTargetCondition | null>(),
    /** 同页面多引导排序（小者优先） */
    priority: integer('priority').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guiders_status_idx').on(t.status), index('guiders_page_idx').on(t.page)],
);

/* ---------- user_guide_progress 用户引导进度表 ---------- */

export const userGuideProgress = pgTable(
  'user_guide_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guideKey: text('guide_key').notNull(),
    /** not_started / in_progress / completed / skipped */
    status: guideProgressStatus('status').notNull().default(GuideProgressStatus.NOT_STARTED),
    /** in_progress 时记录当前步骤，下次从该步骤续接 */
    currentStep: integer('current_step').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_guide_progress_user_guide_key_unique').on(t.userId, t.guideKey),
    index('user_guide_progress_status_idx').on(t.status),
  ],
);

/* ---------- user_events 用户行为事件表（引导 click_count 条件统计） ---------- */

export const userEvents = pgTable(
  'user_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 事件类型（当前固定 event_click） */
    event: text('event').notNull(),
    /** 锚点值（data-guide，如 reveal-view），与 event_click 条件 value 同一标识 */
    target: text('target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('user_events_user_target_idx').on(t.userId, t.event, t.target)],
);

/* ---------- guide_step_events 引导步骤失效事件表（#29 选择器失效监控） ---------- */

export const guideStepEvents = pgTable(
  'guide_step_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guideKey: text('guide_key').notNull(),
    stepId: text('step_id').notNull(),
    /** 运行时实际定位失败的候选选择器（data-guide 优先，其次动态 selector） */
    selector: text('selector').notNull(),
    /** 选择器来源：id / semantic / class / path / data-guide */
    selectorSource: text('selector_source').notNull().default('unknown'),
    /** 失效时的后台相对路径（如 /cron） */
    page: text('page').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('guide_step_events_guide_step_idx').on(t.guideKey, t.stepId),
    index('guide_step_events_created_idx').on(t.createdAt),
  ],
);

/* ---------- 类型导出（M2+ 使用） ---------- */
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type FriendLink = typeof friendLinks.$inferSelect;
export type NewFriendLink = typeof friendLinks.$inferInsert;
export type BackupRecord = typeof backupRecords.$inferSelect;
export type NewBackupRecord = typeof backupRecords.$inferInsert;
export type BackupAuditLog = typeof backupAuditLogs.$inferSelect;
export type NewBackupAuditLog = typeof backupAuditLogs.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Guider = typeof guiders.$inferSelect;
export type NewGuider = typeof guiders.$inferInsert;
export type UserGuideProgress = typeof userGuideProgress.$inferSelect;
export type UserEvent = typeof userEvents.$inferSelect;
export type NewUserEvent = typeof userEvents.$inferInsert;
export type GuideStepEvent = typeof guideStepEvents.$inferSelect;
export type NewGuideStepEvent = typeof guideStepEvents.$inferInsert;

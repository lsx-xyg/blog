/**
 * 备份恢复核心逻辑（T13）
 *
 * 功能：
 * 1. 手动导出 JSON 全量备份（下载到本地 / 上传到存储）
 * 2. 手动导入 JSON 备份（恢复数据）
 * 3. 定时备份（复用 T12 的 cron-job.org/node-cron 双实现）
 * 4. 备份文件上传到存储（复用 T3 的存储抽象，支持 LOCAL/GITHUB/S3）
 * 5. 后台备份管理（查看列表、下载、删除、手动创建、恢复）
 *
 * 备份格式：
 * {
 *   version: "1.0",
 *   createdAt: "2026-09-14T...",
 *   tables: {
 *     posts: [...],
 *     tags: [...],
 *     ...
 *   }
 * }
 */

import { db } from "@/db";
import {
  posts,
  tags,
  postTags,
  media,
  mediaTags,
  settings,
  friendLinks,
  backupRecords,
  users,
  sessions,
  accounts,
  verifications,
} from "@/db/schema";
import { getStorageDriverInstance } from "@/lib/storage";
import { BackupTrigger } from "@/lib/types/backup";
import { eq, desc } from "drizzle-orm";

/** 备份版本 */
const BACKUP_VERSION = "1.0";

/** 需要备份的表（按依赖顺序排列，恢复时按此顺序清空和插入） */
const BACKUP_TABLES = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "posts",
  "tags",
  "postTags",
  "media",
  "mediaTags",
  "settings",
  "friendLinks",
] as const;

type BackupTableName = (typeof BACKUP_TABLES)[number];

/** 表名到 schema 的映射（用 any 绕过类型检查，因为不同表结构不同） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLE_SCHEMA_MAP: Record<BackupTableName, any> = {
  users,
  sessions,
  accounts,
  verifications,
  posts,
  tags,
  postTags,
  media,
  mediaTags,
  settings,
  friendLinks,
};

/** 备份数据结构 */
export interface BackupData {
  version: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * 导出全量备份
 *
 * @returns 备份数据对象
 */
export async function exportBackup(): Promise<BackupData> {
  const tables: Record<string, unknown[]> = {};

  for (const tableName of BACKUP_TABLES) {
    const schema = TABLE_SCHEMA_MAP[tableName];
    const rows = await db.select().from(schema);
    tables[tableName] = rows;
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
  };
}

/**
 * 导入备份（恢复数据）
 *
 * 注意：这是危险操作，会清空所有业务表然后插入备份数据。
 * Better Auth 的核心表（user/session/account/verification）也会被恢复。
 *
 * @param backupData 备份数据对象
 */
export async function importBackup(backupData: BackupData): Promise<void> {
  // 验证版本
  if (backupData.version !== BACKUP_VERSION) {
    throw new Error(`不支持的备份版本: ${backupData.version}，当前版本: ${BACKUP_VERSION}`);
  }

  // 按逆序清空表（先清依赖表，再清主表）
  for (let i = BACKUP_TABLES.length - 1; i >= 0; i--) {
    const tableName = BACKUP_TABLES[i];
    const schema = TABLE_SCHEMA_MAP[tableName];
    await db.delete(schema);
  }

  // 按顺序插入数据
  for (const tableName of BACKUP_TABLES) {
    const schema = TABLE_SCHEMA_MAP[tableName];
    const rows = backupData.tables[tableName];
    if (rows && rows.length > 0) {
      // 分批插入，避免单次插入过多
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await db.insert(schema).values(batch as never[]);
      }
    }
  }
}

/**
 * 创建备份并上传到存储
 *
 * @param triggeredBy 触发方式（MANUAL / AUTO）
 * @returns 备份记录
 */
export async function createBackup(
  triggeredBy: BackupTrigger = BackupTrigger.MANUAL,
): Promise<{ record: typeof backupRecords.$inferSelect; downloadUrl: string }> {
  // 1. 导出备份数据
  const backupData = await exportBackup();

  // 2. 序列化为 JSON Buffer
  const jsonContent = JSON.stringify(backupData, null, 2);
  const buffer = Buffer.from(jsonContent, "utf-8");

  // 3. 生成文件名（按日期分目录）
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `backups/${dateStr}/backup-${timestamp}.json`;

  // 4. 上传到存储
  const driver = await getStorageDriverInstance();
  const uploadResult = await driver.upload(buffer, filename, "application/json");

  // 5. 创建备份记录
  const [record] = await db
    .insert(backupRecords)
    .values({
      fileKey: uploadResult.key,
      size: uploadResult.size,
      triggeredBy,
    })
    .returning();

  return {
    record,
    downloadUrl: uploadResult.url,
  };
}

/**
 * 获取备份列表
 *
 * @param limit 限制数量
 * @returns 备份记录列表
 */
export async function listBackups(limit = 50): Promise<(typeof backupRecords.$inferSelect)[]> {
  return db.select().from(backupRecords).orderBy(desc(backupRecords.createdAt)).limit(limit);
}

/**
 * 获取单个备份记录
 *
 * @param id 备份 ID
 * @returns 备份记录
 */
export async function getBackup(id: string): Promise<typeof backupRecords.$inferSelect | null> {
  const [record] = await db.select().from(backupRecords).where(eq(backupRecords.id, id)).limit(1);
  return record || null;
}

/**
 * 删除备份（同时删除存储中的文件和数据库记录）
 *
 * @param id 备份 ID
 */
export async function deleteBackup(id: string): Promise<void> {
  const record = await getBackup(id);
  if (!record) {
    throw new Error(`备份记录不存在: ${id}`);
  }

  // 1. 删除存储中的文件
  try {
    const driver = await getStorageDriverInstance();
    await driver.delete(record.fileKey);
  } catch (e) {
    // 存储文件删除失败不影响数据库记录删除，记录日志即可
    console.error(`删除存储文件失败: ${record.fileKey}`, e);
  }

  // 2. 删除数据库记录
  await db.delete(backupRecords).where(eq(backupRecords.id, id));
}

/**
 * 下载备份（从存储中读取文件内容）
 *
 * @param id 备份 ID
 * @returns 备份数据 Buffer 和文件名
 */
export async function downloadBackup(id: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const record = await getBackup(id);
  if (!record) {
    throw new Error(`备份记录不存在: ${id}`);
  }

  // 从存储中读取文件
  // 注意：不同驱动的读取方式不同，这里统一通过 URL fetch
  const driver = await getStorageDriverInstance();
  const url = driver.getUrl(record.fileKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载备份文件失败: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 从 fileKey 提取文件名
  const filename = record.fileKey.split("/").pop() || "backup.json";

  return {
    buffer,
    filename,
    mimeType: "application/json",
  };
}

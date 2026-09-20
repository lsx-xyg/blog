/**
 * 备份表映射与行数据变换
 *
 * 职责：备份涉及的表清单、表→schema 映射、行级敏感字段处理与日期还原。
 * 与存储、加密编解码解耦，行变换函数为纯函数（可独立单测）。
 */
import {
  posts,
  tags,
  postTags,
  media,
  mediaTags,
  settings,
  friendLinks,
  backupRecords,
  backupAuditLogs,
  users,
  sessions,
  accounts,
  verifications,
} from "@/db/schema";
import {
  decryptIfAvailable,
  encryptIfAvailable,
  isEncryptionAvailable,
} from "@/lib/crypto/server";

/** 需要备份的表（按依赖顺序排列，恢复时按此顺序清空和插入） */
export const BACKUP_TABLES = [
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

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** 表名到 schema 的映射（用 any 绕过类型检查，因为不同表结构不同） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TABLE_SCHEMA_MAP: Record<BackupTableName, any> = {
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

/** accounts 表中的敏感字段（GitHub OAuth token、密码等） */
export const ACCOUNT_SENSITIVE_FIELDS = [
  "accessToken",
  "refreshToken",
  "idToken",
  "password",
] as const;

/**
 * 处理 accounts 表的敏感字段
 * - 如果 ENCRYPTION_KEY 已配置，加密敏感字段
 * - 如果未配置，脱敏（替换为 null），避免 GitHub secret scanning 检测到
 */
export function sanitizeAccountRow(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row };
  for (const field of ACCOUNT_SENSITIVE_FIELDS) {
    if (result[field] !== null && result[field] !== undefined) {
      if (isEncryptionAvailable()) {
        result[field] = encryptIfAvailable(result[field] as string);
      } else {
        // 未配置加密密钥时脱敏，避免 GitHub secret scanning 阻止上传
        result[field] = null;
      }
    }
  }
  return result;
}

/** 恢复 accounts 表的敏感字段（解密） */
export function restoreAccountRow(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row };
  for (const field of ACCOUNT_SENSITIVE_FIELDS) {
    if (result[field] !== null && result[field] !== undefined && typeof result[field] === "string") {
      result[field] = decryptIfAvailable(result[field] as string);
    }
  }
  return result;
}

/**
 * 把行数据中的日期字符串转换为 Date 对象
 *
 * 备份导出时，Drizzle 返回的日期字段是 Date 对象，但是 JSON.stringify
 * 会把 Date 对象序列化为 ISO 字符串。恢复时需要把这些字符串转换回
 * Date 对象，否则 Drizzle 插入时会调用 toISOString() 失败。
 *
 * 判断规则：字段名以 "At" 结尾（如 createdAt、updatedAt、publishedAt），
 * 且值是字符串且能被 Date 解析。
 */
export function convertDateFields(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string" && key.endsWith("At")) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        result[key] = date;
      }
    }
  }
  return result;
}

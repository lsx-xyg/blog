/**
 * 备份审计日志
 *
 * 职责：审计记录的写入与查询。审计失败不影响主流程（只记错误）。
 */
import { db } from "@/db";
import { backupAuditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { BackupAuditAction } from "@/lib/types/backup";

/**
 * 记录备份审计日志
 *
 * @param backupId 备份记录 ID（可选，备份被删除后仍可记录）
 * @param fileKey 备份文件 key
 * @param action 操作类型（CREATE/DOWNLOAD/DELETE/RESTORE）
 * @param userId 操作人 ID（可选）
 * @param ipAddress 操作人 IP 地址（可选）
 * @param userAgent 操作人 User-Agent（可选）
 */
export async function logBackupAudit(
  backupId: string | null,
  fileKey: string,
  action: BackupAuditAction,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    await db.insert(backupAuditLogs).values({
      backupId,
      fileKey,
      action,
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (e) {
    // 审计日志记录失败不影响主流程，只记录错误
    console.error("[backup] 记录审计日志失败：", e);
  }
}

/**
 * 获取备份审计日志列表
 *
 * @param limit 限制数量（默认 100）
 * @param backupId 按备份 ID 筛选（可选）
 * @param action 按操作类型筛选（可选）
 * @returns 审计日志列表（按时间倒序）
 */
export async function listBackupAuditLogs(
  limit = 100,
  backupId?: string,
  action?: BackupAuditAction,
): Promise<(typeof backupAuditLogs.$inferSelect)[]> {
  // 直接查询所有结果，然后在内存中过滤
  // （drizzle 的动态 where 条件类型比较复杂，这里简化处理）
  const results = await db
    .select()
    .from(backupAuditLogs)
    .orderBy(desc(backupAuditLogs.createdAt))
    .limit(limit);

  // 在内存中过滤
  let filtered = results;
  if (backupId) {
    filtered = filtered.filter((r) => r.backupId === backupId);
  }
  if (action) {
    filtered = filtered.filter((r) => r.action === action);
  }

  return filtered;
}

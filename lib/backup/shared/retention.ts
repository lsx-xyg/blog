/**
 * 备份保留策略（纯逻辑，不做任何 IO）
 *
 * 规则：两项任一超限即清理——创建时间早于 N 天的，或按创建时间倒序排在第 M 位之后的。
 * - retentionDays  = 0 表示不限制天数
 * - retentionCount = 0 表示不限制条数
 * - 两项都为 0 表示不自动清理（清理流程直接跳过）
 *
 * 安全阀：即使全部记录都超限（例如所有备份都比 N 天更早），也至少保留最新的一份，
 * 避免「策略把备份全清空」这种不可逆的意外。
 */
import type { BackupSettings } from '@/lib/types/settings';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 防呆上限：避免误填天文数字让清理逻辑变成事实上的死代码 */
const MAX_RETENTION_VALUE = 10000;

/** 待判定记录的最小形状（DB 备份记录行的子集） */
export type RetentionCandidate = {
  id: string;
  createdAt: Date | string;
};

/** 清理执行结果 */
export type PruneResult = {
  /** 本次实际生效的策略 */
  policy: BackupSettings;
  /** 扫描到的备份总数 */
  scanned: number;
  /** 实际删除的备份 ID */
  deleted: string[];
};

/** 保留策略是否生效（两项都为 0 即关闭自动清理） */
export function isRetentionEnabled(policy: BackupSettings): boolean {
  return policy.retentionDays > 0 || policy.retentionCount > 0;
}

/** 归一化入参：允许原始表单值（字符串 / 数字 / 空值） */
export type RetentionInput = Partial<Record<keyof BackupSettings, unknown>>;

/**
 * 归一化策略值（后台表单与接口入参共用）
 *
 * 非法值 / 负数 / 小数一律归 0（不限制），并做上限防呆。
 */
export function normalizeRetention(policy: RetentionInput): BackupSettings {
  return {
    retentionDays: toRetentionValue(policy.retentionDays),
    retentionCount: toRetentionValue(policy.retentionCount),
  };
}

/** 单个值归一化：非正整数 → 0，超过上限则截断 */
function toRetentionValue(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), MAX_RETENTION_VALUE);
}

/**
 * 计算应清理的备份 ID 列表（纯函数，便于单测）
 *
 * @param records 备份记录（顺序不限，内部按创建时间倒序排列）
 * @param policy  保留策略
 * @param now     当前时间（默认取系统时间，测试可注入）
 * @returns 待删除的备份 ID（新的在前）
 */
export function planPrune(
  records: RetentionCandidate[],
  policy: BackupSettings,
  now: Date = new Date(),
): string[] {
  if (!isRetentionEnabled(policy) || records.length === 0) return [];

  // 新的在前：条数规则按这个顺序保留前 N 条
  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const nowMs = now.getTime();
  const maxAgeMs = policy.retentionDays * DAY_MS;

  const doomed = sorted.filter((record, index) => {
    const ageMs = nowMs - new Date(record.createdAt).getTime();
    const tooOld = policy.retentionDays > 0 && ageMs > maxAgeMs;
    const tooMany = policy.retentionCount > 0 && index >= policy.retentionCount;
    return tooOld || tooMany;
  });

  // 安全阀：全部超限时保留最新的一份（doomed 与 sorted 同为「新的在前」）
  if (doomed.length === sorted.length) {
    return doomed.slice(1).map((record) => record.id);
  }

  return doomed.map((record) => record.id);
}

import { describe, expect, it } from 'vitest';
import { isRetentionEnabled, normalizeRetention, planPrune } from './retention';
import type { RetentionCandidate } from './retention';

/** 固定「当前时间」，避免用例随真实时间漂移 */
const NOW = new Date('2026-09-21T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** 造一条 n 天前创建的备份记录 */
function rec(id: string, ageDays: number): RetentionCandidate {
  return { id, createdAt: new Date(NOW.getTime() - ageDays * DAY_MS) };
}

const OFF = { retentionDays: 0, retentionCount: 0 };

describe('isRetentionEnabled', () => {
  it('两项都为 0 → 关闭', () => {
    expect(isRetentionEnabled(OFF)).toBe(false);
  });

  it('任一为正值 → 生效', () => {
    expect(isRetentionEnabled({ retentionDays: 7, retentionCount: 0 })).toBe(true);
    expect(isRetentionEnabled({ retentionDays: 0, retentionCount: 5 })).toBe(true);
  });
});

describe('normalizeRetention', () => {
  it('非法值 / 负数 / 空 → 0', () => {
    expect(normalizeRetention({})).toEqual(OFF);
    expect(normalizeRetention({ retentionDays: -5, retentionCount: 0 })).toEqual(OFF);
    expect(normalizeRetention({ retentionDays: Number.NaN, retentionCount: 'abc' })).toEqual(OFF);
  });

  it('字符串数字与小数 → 取整', () => {
    expect(normalizeRetention({ retentionDays: '30', retentionCount: 2.7 })).toEqual({
      retentionDays: 30,
      retentionCount: 2,
    });
  });

  it('超大值 → 截断到防呆上限', () => {
    expect(normalizeRetention({ retentionDays: 999999, retentionCount: 0 }).retentionDays).toBe(
      10000,
    );
  });
});

describe('planPrune', () => {
  it('策略关闭 → 不清理（即使记录很旧很多）', () => {
    expect(planPrune([rec('a', 0), rec('b', 999)], OFF, NOW)).toEqual([]);
    expect(planPrune([], { retentionDays: 7, retentionCount: 3 }, NOW)).toEqual([]);
  });

  it('只配天数 → 清理早于 N 天的', () => {
    const records = [rec('a', 0), rec('b', 5), rec('c', 10), rec('d', 30)];
    expect(planPrune(records, { retentionDays: 7, retentionCount: 0 }, NOW)).toEqual(['c', 'd']);
  });

  it('天数边界：恰好 N 天整保留，多 1ms 才清理', () => {
    const exact = { id: 'exact', createdAt: new Date(NOW.getTime() - 7 * DAY_MS) };
    const over = { id: 'over', createdAt: new Date(NOW.getTime() - 7 * DAY_MS - 1) };
    expect(planPrune([exact, over], { retentionDays: 7, retentionCount: 0 }, NOW)).toEqual([
      'over',
    ]);
  });

  it('只配条数 → 按创建时间倒序保留最新 N 条', () => {
    const records = [rec('old', 10), rec('newest', 0), rec('mid', 5)];
    expect(planPrune(records, { retentionDays: 0, retentionCount: 2 }, NOW)).toEqual(['old']);
  });

  it('两项同时配置 → 任一超限即清理（并集）', () => {
    // 倒序后：a(0) b(1) c(2) d(2) e(20)
    // 条数规则砍掉第 3 位起的 d、e；天数规则砍掉 e → 并集 d、e
    const records = [rec('a', 0), rec('b', 1), rec('c', 2), rec('d', 2), rec('e', 20)];
    expect(planPrune(records, { retentionDays: 7, retentionCount: 3 }, NOW)).toEqual(['d', 'e']);
  });

  it('安全阀：全部超限时至少保留最新的一份', () => {
    const records = [rec('newest', 5), rec('older', 9)];
    expect(planPrune(records, { retentionDays: 1, retentionCount: 0 }, NOW)).toEqual(['older']);
  });

  it('返回顺序与入参顺序无关（内部按时间倒序）', () => {
    const ordered = [rec('a', 0), rec('b', 1), rec('c', 9), rec('d', 10)];
    const shuffled = [ordered[2], ordered[0], ordered[3], ordered[1]];
    const policy = { retentionDays: 7, retentionCount: 0 };
    expect(planPrune(shuffled, policy, NOW)).toEqual(planPrune(ordered, policy, NOW));
    expect(planPrune(shuffled, policy, NOW)).toEqual(['c', 'd']);
  });
});

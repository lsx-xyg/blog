import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_ORDER,
  DEFAULT_QUICK_ORDER,
  normalizeCardOrder,
  normalizeQuickOrder,
} from './dashboard-order';

describe('normalizeCardOrder', () => {
  it('null / 非数组输入 → 返回默认顺序', () => {
    expect(normalizeCardOrder(null)).toEqual(DEFAULT_DASHBOARD_ORDER);
    expect(normalizeCardOrder('oops')).toEqual(DEFAULT_DASHBOARD_ORDER);
    expect(normalizeCardOrder(undefined)).toEqual(DEFAULT_DASHBOARD_ORDER);
  });

  it('完整自定义顺序 → 原样保留', () => {
    const custom = [
      'totalViews',
      'totalPosts',
      'totalFriendLinks',
      'totalMedia',
      'totalTags',
      'scheduledPosts',
      'draftPosts',
      'publishedPosts',
    ];
    expect(normalizeCardOrder(custom)).toEqual(custom);
  });

  it('部分顺序 → 缺失默认 key 按默认顺序补全', () => {
    const partial = ['totalViews', 'totalPosts'];
    const result = normalizeCardOrder(partial);
    expect(result.slice(0, 2)).toEqual(['totalViews', 'totalPosts']);
    expect(result).toHaveLength(DEFAULT_DASHBOARD_ORDER.length);
    expect(result).toEqual(expect.arrayContaining(DEFAULT_DASHBOARD_ORDER));
  });

  it('未知 key / 重复 key → 过滤并去重', () => {
    const dirty = ['totalPosts', 'hacked_key', 'totalPosts', 'totalTags', '', 123];
    const result = normalizeCardOrder(dirty);
    expect(result.filter((k) => k === 'totalPosts')).toHaveLength(1);
    expect(result).not.toContain('hacked_key');
    expect(result).not.toContain('');
    expect(new Set(result).size).toBe(result.length);
  });

  it('空数组 → 默认顺序', () => {
    expect(normalizeCardOrder([])).toEqual(DEFAULT_DASHBOARD_ORDER);
  });
});

describe('normalizeQuickOrder', () => {
  it('null / 非数组 → 返回快捷入口默认顺序', () => {
    expect(normalizeQuickOrder(null)).toEqual(DEFAULT_QUICK_ORDER);
    expect(normalizeQuickOrder(42)).toEqual(DEFAULT_QUICK_ORDER);
  });

  it('自定义顺序保留，未知 key 过滤并补全缺失', () => {
    const custom = ['backup', 'cron', 'account'];
    const result = normalizeQuickOrder(custom);
    expect(result.slice(0, 3)).toEqual(['backup', 'cron', 'account']);
    expect(result).toHaveLength(DEFAULT_QUICK_ORDER.length);
    expect(new Set(result).size).toBe(result.length);
    expect(result).toEqual(expect.arrayContaining(DEFAULT_QUICK_ORDER));
  });
});

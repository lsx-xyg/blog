import { describe, expect, it, vi } from 'vitest';

import {
  formatDate,
  isAdminUser,
  keyActivate,
  stripEdgeSlashes,
  trimTrailingSlashes,
} from './utils';

describe('isAdminUser', () => {
  it('空值 / 无 isAdmin 返回 false', () => {
    expect(isAdminUser(undefined)).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({})).toBe(false);
  });

  it('isAdmin 为 true 时返回 true', () => {
    expect(isAdminUser({ isAdmin: true })).toBe(true);
  });

  it('isAdmin 为 false / null 时返回 false', () => {
    expect(isAdminUser({ isAdmin: false })).toBe(false);
    expect(isAdminUser({ isAdmin: null })).toBe(false);
  });
});

describe('formatDate', () => {
  it('空值返回空串', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('Date 对象格式化 YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-09-28T15:30:00Z'))).toBe('2026-09-28');
  });

  it('字符串格式化 YYYY-MM-DD', () => {
    expect(formatDate('2026-09-28T15:30:00Z')).toBe('2026-09-28');
  });
});

describe('trimTrailingSlashes', () => {
  it('去掉尾部斜杠', () => {
    expect(trimTrailingSlashes('https://a.com/')).toBe('https://a.com');
    expect(trimTrailingSlashes('https://a.com///')).toBe('https://a.com');
  });

  it('无尾部斜杠原样返回', () => {
    expect(trimTrailingSlashes('https://a.com')).toBe('https://a.com');
  });

  it('空串安全', () => {
    expect(trimTrailingSlashes('')).toBe('');
  });
});

describe('stripEdgeSlashes', () => {
  it('去掉首尾斜杠', () => {
    expect(stripEdgeSlashes('/a/b/')).toBe('a/b');
    expect(stripEdgeSlashes('//a/b///')).toBe('a/b');
  });

  it('仅开头斜杠 / 仅结尾斜杠', () => {
    expect(stripEdgeSlashes('/a/b')).toBe('a/b');
    expect(stripEdgeSlashes('a/b/')).toBe('a/b');
  });

  it('纯斜杠字符串返回空串', () => {
    expect(stripEdgeSlashes('///')).toBe('');
  });
});

describe('keyActivate', () => {
  it('Enter / 空格触发 handler 并阻止默认行为', () => {
    const handler = vi.fn();
    const activate = keyActivate(handler);
    const e = { key: 'Enter', preventDefault: vi.fn() };
    activate(e as never);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);

    const e2 = { key: ' ', preventDefault: vi.fn() };
    activate(e2 as never);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(e2.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('其他按键不触发', () => {
    const handler = vi.fn();
    keyActivate(handler)({ key: 'Tab', preventDefault: vi.fn() } as never);
    expect(handler).not.toHaveBeenCalled();
  });
});

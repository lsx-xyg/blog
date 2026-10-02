import { describe, expect, it } from 'vitest';
import { localDatetimeToUtcIso, utcIsoToLocalDatetime } from './datetime';

describe('localDatetimeToUtcIso（datetime-local → UTC ISO）', () => {
  it('空值与非法值返回 null', () => {
    expect(localDatetimeToUtcIso(null)).toBeNull();
    expect(localDatetimeToUtcIso(undefined)).toBeNull();
    expect(localDatetimeToUtcIso('')).toBeNull();
    expect(localDatetimeToUtcIso('not-a-date')).toBeNull();
  });

  it('合法值转 UTC ISO 且带 Z 后缀', () => {
    // 本地时区 2026-10-01 12:00 → 用系统时区解释，结果必须可被 Date 解析且带 Z
    const iso = localDatetimeToUtcIso('2026-10-01T12:00');
    expect(iso).toBeTruthy();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // 往返一致性：转回本地应还原原值
    expect(utcIsoToLocalDatetime(iso)).toBe('2026-10-01T12:00');
  });
});

describe('utcIsoToLocalDatetime（UTC ISO → datetime-local）', () => {
  it('空值与非法值返回空串', () => {
    expect(utcIsoToLocalDatetime(null)).toBe('');
    expect(utcIsoToLocalDatetime(undefined)).toBe('');
    expect(utcIsoToLocalDatetime('')).toBe('');
    expect(utcIsoToLocalDatetime('garbage')).toBe('');
  });

  it('UTC 值转本地 datetime-local 格式（分钟粒度）', () => {
    const local = utcIsoToLocalDatetime('2026-10-01T12:34:56.000Z');
    // 无论时区，格式必须为 YYYY-MM-DDTHH:mm
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // 用本地解释回 UTC，应还原原分钟
    const back = localDatetimeToUtcIso(local);
    expect(back?.startsWith('2026-10-01T12:34')).toBe(true);
  });

  it('往返一致（任意时刻）', () => {
    const original = '2026-11-05T08:30';
    expect(utcIsoToLocalDatetime(localDatetimeToUtcIso(original))).toBe(original);
  });
});

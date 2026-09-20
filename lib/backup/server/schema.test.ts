import { afterEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_SENSITIVE_FIELDS,
  convertDateFields,
  restoreAccountRow,
  sanitizeAccountRow,
} from './schema';

const KEY_32 = Buffer.from('b'.repeat(32)).toString('base64');

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('ACCOUNT_SENSITIVE_FIELDS', () => {
  it('覆盖 GitHub OAuth token 与密码字段', () => {
    expect(ACCOUNT_SENSITIVE_FIELDS).toEqual([
      'accessToken',
      'refreshToken',
      'idToken',
      'password',
    ]);
  });
});

describe('sanitizeAccountRow', () => {
  it('配置密钥时加密敏感字段，非敏感字段不动', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const row = {
      id: 'u1',
      accessToken: 'gho_xxx',
      password: 'secret',
      email: 'a@b.com',
    };
    const out = sanitizeAccountRow(row);
    expect(out.email).toBe('a@b.com');
    expect(out.accessToken).not.toBe('gho_xxx');
    // 加密格式：iv:data:tag 三段 base64
    expect(String(out.accessToken).split(':').length).toBe(3);
    expect(String(out.password).split(':').length).toBe(3);
  });

  it('未配置密钥时脱敏为 null（防 GitHub secret scanning）', () => {
    delete process.env.ENCRYPTION_KEY;
    const out = sanitizeAccountRow({ id: 'u1', accessToken: 'gho_xxx', password: 'p' });
    expect(out.accessToken).toBeNull();
    expect(out.password).toBeNull();
  });

  it('null/undefined 字段跳过', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const out = sanitizeAccountRow({ id: 'u1', accessToken: null, password: undefined });
    expect(out.accessToken).toBeNull();
    expect(out.password).toBeUndefined();
  });
});

describe('restoreAccountRow（解密还原）', () => {
  it('加密字段解密还原为明文', () => {
    process.env.ENCRYPTION_KEY = KEY_32;
    const row = { id: 'u1', accessToken: 'gho_yyy', password: 'pw' };
    const sanitized = sanitizeAccountRow(row);
    const restored = restoreAccountRow(sanitized);
    expect(restored.accessToken).toBe('gho_yyy');
    expect(restored.password).toBe('pw');
  });

  it('非加密格式（旧明文）原样返回', () => {
    const out = restoreAccountRow({ id: 'u1', accessToken: 'plain-token' });
    expect(out.accessToken).toBe('plain-token');
  });
});

describe('convertDateFields（日期字符串 → Date）', () => {
  it('以 At 结尾且可解析的字符串转 Date', () => {
    const out = convertDateFields({
      id: '1',
      createdAt: '2026-09-14T10:00:00.000Z',
      publishedAt: '2026-09-15T00:00:00.000Z',
    });
    expect(out.createdAt).toBeInstanceOf(Date);
    expect((out.createdAt as Date).toISOString()).toBe('2026-09-14T10:00:00.000Z');
    expect(out.publishedAt).toBeInstanceOf(Date);
  });

  it('以 At 结尾但不可解析的字符串不动', () => {
    const out = convertDateFields({ id: '1', badAt: 'not-a-date' });
    expect(out.badAt).toBe('not-a-date');
  });

  it('非 At 结尾字段不动（含 Date 实例原样保留）', () => {
    const d = new Date();
    const out = convertDateFields({
      id: '1',
      name: 'x',
      updated: '2026-01-01T00:00:00.000Z',
      obj: d,
    });
    expect(out.name).toBe('x');
    expect(out.updated).toBe('2026-01-01T00:00:00.000Z');
    expect(out.obj).toBe(d);
  });
});

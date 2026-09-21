import { describe, expect, it, vi } from 'vitest';

// site-url.ts 静态依赖 @/lib/settings/server（其导入链含 db 连接校验，
// 测试环境无 DATABASE_URL 会直接抛错）——本文件只测纯函数，mock 掉即可
vi.mock('@/lib/settings/server', () => ({ getConfig: vi.fn() }));

import { normalizeSiteUrl } from './site-url';

describe('normalizeSiteUrl', () => {
  it('保留完整 http(s) 地址', () => {
    expect(normalizeSiteUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeSiteUrl('http://example.com')).toBe('http://example.com');
  });

  it('去掉结尾斜杠（含多个）', () => {
    expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeSiteUrl('https://example.com///')).toBe('https://example.com');
  });

  it('无协议时补 https://（Vercel 注入的域名形如 foo.vercel.app）', () => {
    expect(normalizeSiteUrl('foo.vercel.app')).toBe('https://foo.vercel.app');
    expect(normalizeSiteUrl('foo.vercel.app/')).toBe('https://foo.vercel.app');
  });

  it('去除首尾空白', () => {
    expect(normalizeSiteUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('localhost 显式配置保留 http 协议', () => {
    expect(normalizeSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
});

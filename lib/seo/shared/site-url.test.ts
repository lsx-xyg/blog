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

import { getConfig } from '@/lib/settings/server';
import { getSiteUrlAsync } from './site-url';

const mockGetConfig = vi.mocked(getConfig);

describe('getSiteUrlAsync', () => {
  it('DB 有配置时优先返回（归一化后）', async () => {
    mockGetConfig.mockResolvedValueOnce('https://blog.example.com/');
    expect(await getSiteUrlAsync()).toBe('https://blog.example.com');
  });

  it('DB 抛错时降级到 Vercel 注入域名', async () => {
    mockGetConfig.mockRejectedValueOnce(new Error('db down'));
    const old = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'foo.vercel.app';
    expect(await getSiteUrlAsync()).toBe('https://foo.vercel.app');
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    void old;
  });

  it('DB 无配置且无 Vercel 环境时兜底 localhost', async () => {
    mockGetConfig.mockResolvedValueOnce('' as never);
    const old = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(await getSiteUrlAsync()).toBe('http://localhost:3000');
    if (old) process.env.VERCEL_PROJECT_PRODUCTION_URL = old;
  });
});

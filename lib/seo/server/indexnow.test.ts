import { describe, it, expect, vi } from 'vitest';

// 服务端函数链到 settings → store → @/db（加载时读 DATABASE_URL），
// 纯函数测试不触库，mock 掉 @/db 拦截环境变量检查（与 api.test.ts 同款做法）。
vi.mock('@/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import {
  generateIndexNowKey,
  isValidIndexNowKey,
  buildIndexNowPayload,
  chunkUrlList,
  describeIndexNowStatus,
} from './indexnow';

describe('generateIndexNowKey / isValidIndexNowKey', () => {
  it('生成 32 位十六进制密钥，且两次生成不重复', () => {
    const a = generateIndexNowKey();
    const b = generateIndexNowKey();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('密钥格式校验：8~128 位 hex 合法，其余拒绝', () => {
    expect(isValidIndexNowKey('abcdef01')).toBe(true);
    expect(isValidIndexNowKey('a'.repeat(128))).toBe(true);
    expect(isValidIndexNowKey('abcdef0')).toBe(false); // 7 位
    expect(isValidIndexNowKey('a'.repeat(129))).toBe(false); // 129 位
    expect(isValidIndexNowKey('ABCDEFGH')).toBe(false); // 非 hex（大写）
    expect(isValidIndexNowKey('../etc/passwd')).toBe(false);
    expect(isValidIndexNowKey('')).toBe(false);
  });
});

describe('buildIndexNowPayload', () => {
  it('组装 host / key / urlList，未给 keyLocation 时省略该字段', () => {
    const payload = buildIndexNowPayload({
      host: 'blog.example.com',
      key: 'a'.repeat(32),
      urlList: ['https://blog.example.com/posts/hello'],
    });
    expect(payload).toEqual({
      host: 'blog.example.com',
      key: 'a'.repeat(32),
      urlList: ['https://blog.example.com/posts/hello'],
    });
  });

  it('给了 keyLocation 时带上', () => {
    const payload = buildIndexNowPayload({
      host: 'blog.example.com',
      key: 'a'.repeat(32),
      urlList: ['https://blog.example.com/'],
      keyLocation: 'https://blog.example.com/' + 'a'.repeat(32) + '.txt',
    });
    expect(payload.keyLocation).toBe('https://blog.example.com/' + 'a'.repeat(32) + '.txt');
  });
});

describe('chunkUrlList', () => {
  it('空列表 → 无分块', () => {
    expect(chunkUrlList([])).toEqual([]);
  });

  it('不超过上限时整块返回', () => {
    const urls = ['https://a.com/1', 'https://a.com/2'];
    expect(chunkUrlList(urls, 10)).toEqual([urls]);
  });

  it('超过上限时按块切分且不丢不重', () => {
    const urls = Array.from({ length: 25 }, (_, i) => `https://a.com/${i}`);
    const chunks = chunkUrlList(urls, 10);
    expect(chunks.map((c) => c.length)).toEqual([10, 10, 5]);
    expect(chunks.flat()).toEqual(urls);
  });
});

describe('describeIndexNowStatus', () => {
  it('200/202 视为成功，202 提示密钥校验进行中', () => {
    expect(describeIndexNowStatus(200).ok).toBe(true);
    const accepted = describeIndexNowStatus(202);
    expect(accepted.ok).toBe(true);
    expect(accepted.message).toContain('202');
  });

  it('400/403/422/429 视为失败且各有语义', () => {
    expect(describeIndexNowStatus(400).ok).toBe(false);
    expect(describeIndexNowStatus(403).message).toContain('密钥');
    expect(describeIndexNowStatus(422).message).toContain('URL');
    expect(describeIndexNowStatus(429).ok).toBe(false);
  });

  it('未知状态码兜底', () => {
    expect(describeIndexNowStatus(500).ok).toBe(false);
    expect(describeIndexNowStatus(500).message).toContain('500');
  });
});

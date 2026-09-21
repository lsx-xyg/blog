/**
 * 私有存储档案的 upload 契约测试
 *
 * 背景（踩过的坑）：WebDAV 与「未配 publicBase 的 S3」都没有公开访问 URL，
 * 早期实现的 upload() 会在 PUT/PutObject 成功之后调用 getUrl() 拼返回的 url，
 * 于是 getUrl 抛错把整个上传判为失败——文件其实已经写进远端了，
 * 调用方还会因为抛错跳过后续清理，留下孤儿文件（后台「测试连通性」就报
 * "连通失败：WebDAV 档案不支持公开访问 URL"，但文件确实传上去了）。
 *
 * 本测试锁住新契约：私有档案 upload 必须成功，url 返回空串；getUrl 只对真正
 * 需要公开地址的调用方抛错。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebdavStorageDriver } from './webdav';
import { S3StorageDriver } from './s3';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WebdavStorageDriver（私有通道）', () => {
  const config = {
    url: 'https://dav.example.com/dav/',
    username: 'u',
    password: 'p',
    directory: 'backups',
  };

  it('getUrl 抛错，提示走 download()', () => {
    const driver = new WebdavStorageDriver(config);
    expect(() => driver.getUrl('2026/09/x.txt')).toThrow(/公开访问 URL/);
  });

  it('upload 不受 getUrl 影响：成功返回 key，url 为空串', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push(`${method} ${input}`);
        // MKCOL 405 = 目录已存在（预期的正常分支）
        return new Response(null, { status: method === 'MKCOL' ? 405 : 201 });
      }),
    );

    const driver = new WebdavStorageDriver(config);
    const result = await driver.upload(Buffer.from('probe'), 'storage-probe.txt', 'text/plain');

    expect(result.url).toBe('');
    expect(result.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]+\.txt$/);
    expect(result.size).toBe(5);
    expect(result.mimeType).toBe('text/plain');
    // 先逐级建目录再 PUT，且带上档案配置的子目录
    expect(calls[0]).toBe('MKCOL https://dav.example.com/dav/backups/');
    expect(calls.some((c) => c.startsWith('PUT https://dav.example.com/dav/backups/'))).toBe(true);
  });

  it('download 读回内容；delete 404 视为成功', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init?: RequestInit) =>
        init?.method === 'DELETE' ? new Response(null, { status: 404 }) : new Response('probe'),
      ),
    );

    const driver = new WebdavStorageDriver(config);
    const buffer = await driver.download('2026/09/x.txt');
    expect(buffer.toString()).toBe('probe');
    await expect(driver.delete('2026/09/x.txt')).resolves.toBeUndefined();
  });

  it('delete 权限不足（403）会抛错，供连通性测试判定"删除失败"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init?: RequestInit) =>
        init?.method === 'DELETE' ? new Response(null, { status: 403 }) : new Response('probe'),
      ),
    );

    const driver = new WebdavStorageDriver(config);
    await expect(driver.delete('2026/09/x.txt')).rejects.toThrow(/403/);
  });
});

describe('S3StorageDriver（未配 publicBase 的私有档案）', () => {
  const baseConfig = {
    endpoint: 'https://account.r2.cloudflarestorage.com',
    bucket: 'bucket',
    region: 'auto',
    directory: 'backups',
    accessKey: 'ak',
    secretKey: 'sk',
  };

  /** 替换内部 S3Client，避免真实网络调用 */
  function stubClient(driver: S3StorageDriver) {
    (driver as unknown as { client: { send: () => Promise<unknown> } }).client = {
      send: async () => ({}),
    };
  }

  it('getUrl 缺 publicBase 时抛错', () => {
    const driver = new S3StorageDriver({ ...baseConfig, publicBase: '' });
    expect(() => driver.getUrl('2026/09/x.txt')).toThrow(/publicBase/);
  });

  it('upload 不受 publicBase 影响：成功返回 key，url 为空串', async () => {
    const driver = new S3StorageDriver({ ...baseConfig, publicBase: '' });
    stubClient(driver);

    const result = await driver.upload(Buffer.from('probe'), 'backup.json', 'application/json');
    expect(result.url).toBe('');
    expect(result.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]+\.json$/);
  });

  it('配了 publicBase 时 upload 返回完整公开 URL', async () => {
    const driver = new S3StorageDriver({ ...baseConfig, publicBase: 'https://img.example.com/' });
    stubClient(driver);

    const result = await driver.upload(Buffer.from('probe'), 'pic.png', 'image/png');
    expect(result.url).toBe(`https://img.example.com/backups/${result.key}`);
  });
});

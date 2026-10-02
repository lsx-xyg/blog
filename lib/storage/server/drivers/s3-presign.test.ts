import { describe, expect, it, vi, beforeEach } from 'vitest';
import { S3StorageDriver } from './s3';

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(async () => 'https://signed.example/upload'),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

function makeDriver(overrides: Record<string, string> = {}) {
  return new S3StorageDriver({
    endpoint: 'https://example.r2.cloudflarestorage.com',
    bucket: 'test-bucket',
    region: 'auto',
    publicBase: 'https://cdn.example.com',
    directory: '',
    accessKey: 'test-key',
    secretKey: 'test-secret',
    ...overrides,
  } as never);
}

/** 取最后一次 getSignedUrl 调用参数（mock.calls 推断为空 tuple，强转结构化） */
function lastCall() {
  return getSignedUrlMock.mock.calls[0] as unknown as [
    unknown,
    { constructor: { name: string }; input: Record<string, unknown> },
    { expiresIn: number },
  ];
}

describe('S3StorageDriver 预签名直传', () => {
  beforeEach(() => {
    getSignedUrlMock.mockClear();
    getSignedUrlMock.mockResolvedValue('https://signed.example/upload');
  });

  it('标记支持预签名直传', () => {
    expect(makeDriver().supportsPresignedUpload).toBe(true);
  });

  it('生成存储键并透传 ContentType 与默认有效期', async () => {
    const driver = makeDriver();
    const result = await driver.getPresignedUploadUrl({ contentType: 'video/mp4' });

    expect(result.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]{32}\.mp4$/);
    expect(result.url).toBe(`https://cdn.example.com/${result.key}`);
    expect(result.presignedUrl).toBe('https://signed.example/upload');

    const [, command, opts] = lastCall();
    expect(command.constructor.name).toBe('PutObjectCommand');
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: result.key,
      ContentType: 'video/mp4',
    });
    expect(opts).toEqual({ expiresIn: 600 });
  });

  it('支持自定义 key 与 expiresIn', async () => {
    const driver = makeDriver();
    const result = await driver.getPresignedUploadUrl({
      key: '2026/10/my-video.mp4',
      contentType: 'video/webm',
      expiresIn: 120,
    });

    expect(result.key).toBe('2026/10/my-video.mp4');
    const [, command, opts] = lastCall();
    expect(command.input.Key).toBe('2026/10/my-video.mp4');
    expect(command.input.ContentType).toBe('video/webm');
    expect(opts).toEqual({ expiresIn: 120 });
  });

  it('directory 前缀拼进 Key 与访问 URL', async () => {
    const driver = makeDriver({ directory: 'videos' });
    const result = await driver.getPresignedUploadUrl({ contentType: 'video/mp4' });

    const [, command] = lastCall();
    expect(command.input.Key).toBe(`videos/${result.key}`);
    expect(result.url).toBe(`https://cdn.example.com/videos/${result.key}`);
  });

  it('未配 publicBase 时上传结果 url 为空串', async () => {
    const driver = makeDriver({ publicBase: '' });
    const result = await driver.getPresignedUploadUrl({ contentType: 'video/mp4' });

    expect(result.url).toBe('');
    expect(result.key).toMatch(/\.mp4$/);
  });

  it('getPresignedDownloadUrl 用 GetObjectCommand', async () => {
    const driver = makeDriver();
    const url = await driver.getPresignedDownloadUrl('2026/10/a.mp4', 7200);

    expect(url).toBe('https://signed.example/upload');
    const [, command, opts] = lastCall();
    expect(command.constructor.name).toBe('GetObjectCommand');
    expect(command.input).toMatchObject({ Bucket: 'test-bucket', Key: '2026/10/a.mp4' });
    expect(opts).toEqual({ expiresIn: 7200 });
  });

  it('未配置 bucket 时抛错', async () => {
    const driver = makeDriver({ bucket: '' });
    await expect(driver.getPresignedUploadUrl({ contentType: 'video/mp4' })).rejects.toThrow(
      /未配置 bucket/,
    );
  });
});

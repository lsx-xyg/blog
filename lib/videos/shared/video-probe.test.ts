import { describe, expect, it } from 'vitest';
import { validateClientFile, parsePresignResponse, buildVideoCallbackBody } from './video-probe';

describe('validateClientFile', () => {
  it('接受 mp4 / webm', () => {
    expect(validateClientFile({ type: 'video/mp4', size: 1024 }, 200)).toEqual({ ok: true });
    expect(validateClientFile({ type: 'video/webm', size: 1024 }, 200)).toEqual({ ok: true });
  });

  it('拒绝不支持的格式', () => {
    const r = validateClientFile({ type: 'video/quicktime', size: 1024 }, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNSUPPORTED_TYPE');
  });

  it('拒绝空文件', () => {
    const r = validateClientFile({ type: 'video/mp4', size: 0 }, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_FILE');
  });

  it('大小边界：恰好等于上限通过，超过拒绝', () => {
    expect(validateClientFile({ type: 'video/mp4', size: 200 * 1024 * 1024 }, 200)).toEqual({
      ok: true,
    });
    const r = validateClientFile({ type: 'video/mp4', size: 200 * 1024 * 1024 + 1 }, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FILE_TOO_LARGE');
  });
});

describe('parsePresignResponse', () => {
  it('LOCAL → multipart 降级', () => {
    expect(parsePresignResponse({ code: 'PRESIGN_UNSUPPORTED', driver: 'LOCAL' })).toEqual({
      ok: true,
      mode: 'multipart',
    });
  });

  it('GITHUB/WEBDAV → rejected', () => {
    expect(parsePresignResponse({ code: 'VIDEO_DRIVER_UNSUPPORTED', driver: 'GITHUB' })).toEqual({
      ok: true,
      mode: 'rejected',
      driver: 'GITHUB',
    });
  });

  it('S3 正常 → presigned（contentType/maxSizeMb 透传）', () => {
    expect(
      parsePresignResponse({
        presignedUrl: 'https://s3.example/put',
        key: 'videos/2026/10/a.mp4',
        url: 'https://cdn.example/videos/2026/10/a.mp4',
        driver: 'S3',
        contentType: 'video/mp4',
        maxSizeMb: 200,
      }),
    ).toEqual({
      ok: true,
      mode: 'presigned',
      presignedUrl: 'https://s3.example/put',
      key: 'videos/2026/10/a.mp4',
      url: 'https://cdn.example/videos/2026/10/a.mp4',
      contentType: 'video/mp4',
      maxSizeMb: 200,
    });
  });

  it('presigned 缺 contentType/maxSizeMb 时给默认值', () => {
    const r = parsePresignResponse({ presignedUrl: 'u', key: 'k' });
    expect(r.ok && r.mode === 'presigned').toBe(true);
    if (r.ok && r.mode === 'presigned') {
      expect(r.contentType).toBe('application/octet-stream');
      expect(r.maxSizeMb).toBe(200);
    }
  });

  it('无法识别 → BAD_RESPONSE', () => {
    expect(parsePresignResponse(null)).toEqual({ ok: false, code: 'BAD_RESPONSE' });
    expect(parsePresignResponse({ foo: 1 })).toEqual({ ok: false, code: 'BAD_RESPONSE' });
    expect(parsePresignResponse('nope')).toEqual({ ok: false, code: 'BAD_RESPONSE' });
  });
});

describe('buildVideoCallbackBody', () => {
  it('只含白名单字段，可选字段缺省不出现', () => {
    const body = buildVideoCallbackBody({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: 100,
      durationSeconds: 12,
      width: 1920,
      height: 1080,
      title: '标题',
    });
    expect(body).toEqual({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: 100,
      durationSeconds: 12,
      width: 1920,
      height: 1080,
      title: '标题',
    });
  });

  it('空值/null 不进回调体', () => {
    const body = buildVideoCallbackBody({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: null,
      url: '',
    });
    expect(body).toEqual({ key: 'k.mp4', mimeType: 'video/mp4', size: null });
  });

  it('posterMediaId 有值时进回调体，缺省时不出现在回调体', () => {
    const withPoster = buildVideoCallbackBody({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: 100,
      posterMediaId: 'media-id-1',
    });
    expect(withPoster).toEqual({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: 100,
      posterMediaId: 'media-id-1',
    });

    const withoutPoster = buildVideoCallbackBody({
      key: 'k.mp4',
      mimeType: 'video/mp4',
      size: 100,
      posterMediaId: null,
    });
    expect(withoutPoster).toEqual({ key: 'k.mp4', mimeType: 'video/mp4', size: 100 });
  });
});

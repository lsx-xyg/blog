import { describe, expect, it } from 'vitest';
import { validateVideoUpload, presignCodeForDriver, PRESIGN_CODES } from './validate';

const MB = 1024 * 1024;

describe('validateVideoUpload', () => {
  it('接受 mp4/webm 且大小在限制内', () => {
    expect(
      validateVideoUpload({ mimeType: 'video/mp4', size: 50 * MB, maxSizeBytes: 200 * MB }),
    ).toEqual({
      ok: true,
    });
    expect(
      validateVideoUpload({ mimeType: 'video/webm', size: 0, maxSizeBytes: 200 * MB }),
    ).toEqual({
      ok: true,
    });
  });

  it('拒绝不支持的 MIME', () => {
    const r = validateVideoUpload({ mimeType: 'video/avi', size: 10 * MB, maxSizeBytes: 200 * MB });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mp4 \/ webm/);
  });

  it('拒绝空 MIME', () => {
    expect(validateVideoUpload({ mimeType: null, size: 10, maxSizeBytes: 200 * MB }).ok).toBe(
      false,
    );
    expect(validateVideoUpload({ mimeType: undefined, size: 10, maxSizeBytes: 200 * MB }).ok).toBe(
      false,
    );
  });

  it('拒绝超限大小（含边界）', () => {
    expect(
      validateVideoUpload({ mimeType: 'video/mp4', size: 201 * MB, maxSizeBytes: 200 * MB }).ok,
    ).toBe(false);
    expect(
      validateVideoUpload({ mimeType: 'video/mp4', size: 200 * MB, maxSizeBytes: 200 * MB }).ok,
    ).toBe(true);
  });

  it('size 缺省时不校验大小', () => {
    expect(validateVideoUpload({ mimeType: 'video/mp4', size: null, maxSizeBytes: 1 }).ok).toBe(
      true,
    );
  });
});

describe('presignCodeForDriver', () => {
  it('local → 降级 multipart', () => {
    expect(presignCodeForDriver('local')).toBe(PRESIGN_CODES.PRESIGN_UNSUPPORTED);
  });

  it('github/webdav → 拒绝', () => {
    expect(presignCodeForDriver('github')).toBe(PRESIGN_CODES.VIDEO_DRIVER_UNSUPPORTED);
    expect(presignCodeForDriver('webdav')).toBe(PRESIGN_CODES.VIDEO_DRIVER_UNSUPPORTED);
  });
});

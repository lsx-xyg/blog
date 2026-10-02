/**
 * 视频上传服务端校验（纯函数，可单测）
 *
 * presign 分支 code 见 shared/presign.ts（前后端共用，避免 shared→server 倒挂）。
 */
import { ALLOWED_VIDEO_MIME_TYPES } from '@/lib/types/video';
import { PRESIGN_CODES, type PresignCode } from '../shared/presign';

export { PRESIGN_CODES, type PresignCode } from '../shared/presign';

/** MIME + 大小校验，返回归一化错误信息 */
export function validateVideoUpload(input: {
  mimeType: string | null | undefined;
  size: number | null | undefined;
  maxSizeBytes: number;
}): { ok: true } | { ok: false; error: string } {
  const { mimeType, size, maxSizeBytes } = input;

  if (!mimeType || !(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return {
      ok: false,
      error: `不支持的视频格式：${mimeType ?? '未知'}，仅支持 mp4 / webm`,
    };
  }
  if (size != null && size > maxSizeBytes) {
    return {
      ok: false,
      error: `视频大小超过限制：${(size / 1024 / 1024).toFixed(2)}MB，最大 ${Math.floor(maxSizeBytes / 1024 / 1024)}MB`,
    };
  }
  return { ok: true };
}

/** 按驱动名映射 presign 分支 code（local → 降级，其余不支持驱动的 → 拒绝） */
export function presignCodeForDriver(driverName: string): PresignCode {
  return driverName === 'local'
    ? PRESIGN_CODES.PRESIGN_UNSUPPORTED
    : PRESIGN_CODES.VIDEO_DRIVER_UNSUPPORTED;
}

/** 预签名 URL 有效期（秒）：小文件 600s，≥50MB 或未知大小给 3600s（200MB 大文件上传时间更长） */
export function presignExpiresForSize(size: number | null | undefined): number {
  return size != null && size < 50 * 1024 * 1024 ? 600 : 3600;
}

/**
 * 视频上传服务端校验（纯函数，可单测）
 *
 * presign 分支 code（前端据此决策）：
 * - PRESIGN_UNSUPPORTED      → LOCAL：走 multipart 降级
 * - VIDEO_DRIVER_UNSUPPORTED → GITHUB/WEBDAV：拒绝（UI 提示改用 S3）
 */
import { ALLOWED_VIDEO_MIME_TYPES } from '@/lib/types/video';

export const PRESIGN_CODES = {
  PRESIGN_UNSUPPORTED: 'PRESIGN_UNSUPPORTED',
  VIDEO_DRIVER_UNSUPPORTED: 'VIDEO_DRIVER_UNSUPPORTED',
} as const;

export type PresignCode = (typeof PRESIGN_CODES)[keyof typeof PRESIGN_CODES];

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

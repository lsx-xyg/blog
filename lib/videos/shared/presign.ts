/**
 * 视频预签名业务常量（shared：前后端共用，避免 shared→server 倒挂）
 *
 * presign 分支 code（前端据此决策）：
 * - PRESIGN_UNSUPPORTED      → LOCAL：走 multipart 降级
 * - VIDEO_DRIVER_UNSUPPORTED → GITHUB/WEBDAV：拒绝（UI 提示改用 S3）
 */
export const PRESIGN_CODES = {
  PRESIGN_UNSUPPORTED: 'PRESIGN_UNSUPPORTED',
  VIDEO_DRIVER_UNSUPPORTED: 'VIDEO_DRIVER_UNSUPPORTED',
} as const;

export type PresignCode = (typeof PRESIGN_CODES)[keyof typeof PRESIGN_CODES];

/**
 * 视频上传前端纯函数（可单测）
 *
 * 边界约定：
 * - 纯函数：文件校验（mime/size）、presign 响应分支判定、回调体构造
 * - DOM 部分（<video> loadedmetadata 取时长/宽高）在组件内实现，不进本文件
 * - 常量来源：ALLOWED_VIDEO_MIME_TYPES（lib/types/video）、PRESIGN_CODES（shared/presign）
 */
import { ALLOWED_VIDEO_MIME_TYPES } from '@/lib/types/video';
import { PRESIGN_CODES } from './presign';

export type ClientFileCheck =
  | { ok: true }
  | { ok: false; code: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'EMPTY_FILE'; error: string };

/** 客户端文件校验（mime 白名单 + 大小上限 + 非空） */
export function validateClientFile(
  file: { type: string; size: number },
  maxSizeMb: number,
): ClientFileCheck {
  if (!(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_TYPE',
      error: `不支持的视频格式：${file.type || '未知'}，仅支持 mp4 / webm`,
    };
  }
  if (!file.size || file.size <= 0) {
    return { ok: false, code: 'EMPTY_FILE', error: '文件为空' };
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      error: `视频超过大小上限：${(file.size / 1024 / 1024).toFixed(2)}MB，最大 ${maxSizeMb}MB`,
    };
  }
  return { ok: true };
}

export type PresignParsed =
  | { ok: true; mode: 'multipart' }
  | { ok: true; mode: 'rejected'; driver: string }
  | {
      ok: true;
      mode: 'presigned';
      presignedUrl: string;
      key: string;
      url: string;
      /** PUT 的 Content-Type 头必须从这里取（与 presign 时指定的一致，否则签名拒绝） */
      contentType: string;
      maxSizeMb: number;
    }
  | { ok: false; code: 'BAD_RESPONSE' };

/** 归一化 presign 响应（只处理 200 的业务分支；网络/4xx/5xx 由调用方在 res.ok 处拦截） */
export function parsePresignResponse(json: unknown): PresignParsed {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (obj.code === PRESIGN_CODES.PRESIGN_UNSUPPORTED) {
      return { ok: true, mode: 'multipart' };
    }
    if (obj.code === PRESIGN_CODES.VIDEO_DRIVER_UNSUPPORTED) {
      return { ok: true, mode: 'rejected', driver: String(obj.driver ?? '') };
    }
    if (typeof obj.presignedUrl === 'string' && typeof obj.key === 'string') {
      return {
        ok: true,
        mode: 'presigned',
        presignedUrl: obj.presignedUrl,
        key: obj.key,
        url: typeof obj.url === 'string' ? obj.url : '',
        contentType:
          typeof obj.contentType === 'string' && obj.contentType
            ? obj.contentType
            : 'application/octet-stream',
        maxSizeMb: typeof obj.maxSizeMb === 'number' && obj.maxSizeMb > 0 ? obj.maxSizeMb : 200,
      };
    }
  }
  return { ok: false, code: 'BAD_RESPONSE' };
}

/** 构造预签名直传回调体（只含服务端白名单字段） */
export function buildVideoCallbackBody(input: {
  key: string;
  url?: string | null;
  mimeType: string;
  size: number | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  posterMediaId?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    key: input.key,
    mimeType: input.mimeType,
    size: input.size ?? null,
  };
  if (input.url) body.url = input.url;
  if (input.durationSeconds != null) body.durationSeconds = input.durationSeconds;
  if (input.width != null) body.width = input.width;
  if (input.height != null) body.height = input.height;
  if (input.title) body.title = input.title;
  if (input.posterMediaId) body.posterMediaId = input.posterMediaId;
  return body;
}

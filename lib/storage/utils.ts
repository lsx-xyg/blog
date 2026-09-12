import { randomUUID } from "crypto";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from "./types";

/** 生成存储键：YYYY/MM/uuid.ext
 * 按日期分目录，UUID 文件名避免冲突，保留原扩展名
 */
export function generateKey(originalFilename: string): string {
  const ext = getExtension(originalFilename);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = randomUUID().replace(/-/g, "");
  return `${year}/${month}/${uuid}${ext}`;
}

/** 从文件名提取扩展名（包含点，如 .jpg） */
export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx).toLowerCase();
}

/** 校验图片是否合法（MIME 类型 + 大小） */
export function validateImage(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `不支持的图片格式：${mimeType}，仅支持 ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
    };
  }
  if (size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `图片大小超过限制：${(size / 1024 / 1024).toFixed(2)}MB，最大 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

/** 从 MIME 类型推断扩展名 */
export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mimeType] || "";
}

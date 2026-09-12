import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local-driver";
import { GithubStorageDriver } from "./github-driver";
import { S3StorageDriver } from "./s3-driver";

export type { StorageDriver, UploadResult } from "./types";
export { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from "./types";
export { LocalStorageDriver } from "./local-driver";
export { GithubStorageDriver } from "./github-driver";
export { S3StorageDriver } from "./s3-driver";
export { generateKey, validateImage, getExtension, mimeToExt } from "./utils";

/** 存储驱动类型枚举（全大写，对齐用户偏好） */
export type StorageDriverType = "LOCAL" | "GITHUB" | "S3";

/** 单例缓存 */
let driverInstance: StorageDriver | null = null;

/** 获取当前配置的存储驱动（单例）
 *
 * 环境变量 STORAGE_DRIVER 决定使用哪个驱动：
 * - LOCAL：本地文件存储（开发默认）
 * - GITHUB：GitHub 图床（生产推荐）
 * - S3：S3 兼容存储（占位）
 *
 * 读取时对小写做转大写兜底校验（对齐用户偏好）
 */
export function getStorageDriver(): StorageDriver {
  if (driverInstance) return driverInstance;

  const raw = (process.env.STORAGE_DRIVER || "LOCAL").toUpperCase();
  let driverType: StorageDriverType;

  if (raw === "LOCAL" || raw === "GITHUB" || raw === "S3") {
    driverType = raw;
  } else {
    console.warn(`[storage] 未知的 STORAGE_DRIVER 值：${raw}，回退到 LOCAL`);
    driverType = "LOCAL";
  }

  switch (driverType) {
    case "GITHUB":
      driverInstance = new GithubStorageDriver();
      break;
    case "S3":
      driverInstance = new S3StorageDriver();
      break;
    case "LOCAL":
    default:
      driverInstance = new LocalStorageDriver();
      break;
  }

  console.log(`[storage] 使用存储驱动：${driverInstance.name}`);
  return driverInstance;
}

/** 重置单例（测试用） */
export function resetStorageDriver(): void {
  driverInstance = null;
}
